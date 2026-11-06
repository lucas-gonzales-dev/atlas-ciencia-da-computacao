// Projeto Atlas — marcar a próxima sessão na agenda (S19b, 06/11/2026, J5 item 3).
//
// POR QUE EXISTE: o Atlas não pode notificar — é estático, sem conta, e o desenho
// veta isso. O que ele pode é devolver um `.ics` para a agenda DELA, no fim de
// uma sessão, quando a pessoa ainda está com vontade de voltar. Aqui mora só o
// desenho e o toque: a regra do texto é core/agenda.js e o caminho de download é
// core/dados-pessoa.js `baixarArquivo` — os dois travados, nenhum copiado.
//
// TRÊS REGRAS QUE DEFINEM O BLOCO:
// 1. **Link discreto, nunca botão.** O primário da tela é um só, e ele não é um
//    convite a voltar quando a sessão já acabou.
// 2. **O `input` manda, o core decide.** Dia e hora saem dos campos como o
//    navegador os entrega; inválidos, `icsDaSessao` devolve `null` e nada é
//    baixado. Um `.ics` meio feito marca um dia que a pessoa não escolheu.
// 3. **O estado mora no nó.** Duas telas usam o bloco (a aula estudada e o fim da
//    revisão); uma variável de módulo faria a agenda de uma abrir na outra.
import { baixarArquivo } from '../core/dados-pessoa.js';
import { NOME_ARQUIVO, icsDaSessao } from '../core/agenda.js';
import { diaSeguinte } from '../core/cartoes.js';
import { agenda as A } from '../core/textos.js';

/** O id dos campos é único por bloco: dois blocos dariam `<label for>` ambíguo. */
let blocos = 0;

function campo(doc, { id, rotulo, tipo, valor }) {
  const caixa = doc.createElement('div');
  caixa.className = 'agenda-campo';
  const etiqueta = doc.createElement('label');
  etiqueta.className = 'agenda-rotulo';
  etiqueta.textContent = rotulo;
  etiqueta.setAttribute('for', id);
  // `htmlFor` como PROPRIEDADE além do atributo: é assim que a régua `leitor 6`
  // da casa acha o nome do campo (mesma lição de aula.js:318).
  etiqueta.htmlFor = id;
  const entrada = doc.createElement('input');
  entrada.className = 'agenda-entrada';
  entrada.setAttribute('type', tipo);
  entrada.setAttribute('id', id);
  entrada.value = valor;
  caixa.append(etiqueta, entrada);
  return { caixa, entrada };
}

/**
 * O bloco: um link que vira dois campos e um secundário.
 *
 * @param {Document} doc
 * @param {object} win o navegador, para o Blob do download
 * @param {{hoje?: string, url?: string}} dados `hoje` em `aaaa-mm-dd` local
 * @returns {Element} o contêiner, que se troca ao toque
 */
export function blocoDaAgenda(doc, win, { hoje = '', url = '' } = {}) {
  const raiz = doc.createElement('div');
  raiz.className = 'agenda';
  const abrir = doc.createElement('a');
  abrir.className = 'agenda-abrir';
  abrir.href = '#';
  abrir.textContent = A.abrir;
  raiz.append(abrir);

  abrir.addEventListener('click', (evento) => {
    evento?.preventDefault?.();
    const base = `agenda-${++blocos}`;
    // Amanhã por padrão: «hoje à noite» é a escolha de quem ainda não parou, e o
    // bloco aparece justo depois de a pessoa parar.
    const dia = campo(doc, { id: `${base}-dia`, rotulo: A.dia, tipo: 'date', valor: diaSeguinte(hoje) });
    const hora = campo(doc, { id: `${base}-hora`, rotulo: A.hora, tipo: 'time', valor: '19:00' });
    const baixar = doc.createElement('button');
    baixar.className = 'botao botao-secundario agenda-baixar';
    baixar.setAttribute('type', 'button');
    baixar.textContent = A.baixar;
    const aviso = doc.createElement('p');
    aviso.className = 'agenda-aviso';
    aviso.setAttribute('role', 'status');
    aviso.setAttribute('tabindex', '-1');

    raiz.textContent = '';
    raiz.className = 'agenda agenda-aberto';
    raiz.append(dia.caixa, hora.caixa, baixar, aviso);
    dia.entrada.focus?.();

    baixar.addEventListener('click', (evento2) => {
      evento2?.preventDefault?.();
      const texto = icsDaSessao({ dia: dia.entrada.value, hora: hora.entrada.value, titulo: A.titulo, url });
      if (!texto) {
        // Campo vazio: NENHUMA frase, e o foco vai para o campo em falta.
        // `semDownload`diria «o navegador não deixou» quando foi a pessoa que não
        // disse o dia — uma mentira sobre a máquina. O `input` tem rótulo próprio
        // («Dia», «Hora»), então pousar ali já é a resposta, e o teclado continua
        // onde o trabalho acontece.
        const emFalta = dia.entrada.value ? hora.entrada : dia.entrada;
        emFalta.focus?.();
        return;
      }
      const feito = baixarArquivo({ doc, win, nome: NOME_ARQUIVO, texto, tipo: 'text/calendar' });
      aviso.textContent = feito ? A.pronto : A.semDownload;
      aviso.focus?.();
    });
  });

  return raiz;
}
