// Projeto Atlas — o arquivo .ics da próxima sessão (S19b, 06/11/2026, desenho J5 item 3).
//
// POR QUE EXISTE: o app não pode notificar ninguém. Ele é estático, roda sem
// conta, sem servidor e sem permissão de notificação, e o desenho (J5, item 3)
// recusa exatamente isso: nada de notificação, conta ou rede. O que sobra é a
// pessoa levar o compromisso para a agenda DELA — um arquivo `.ics` que o
// navegador baixa e o calendário do aparelho instala. Este módulo é a única
// regra dessa coisa: recebe dia, hora e título, devolve o texto do arquivo. Zero
// DOM, zero `window`, zero storage — quem baixa é a tela.
//
// A TRAVA QUE O FORMATO IMPÕE: um .ics malformado não dá erro na tela, dá um
// evento que o calendário recusa em silêncio. Quem aperta o botão e não vê nada
// novo na agenda conclui que o app não funciona. Por isso as três regras abaixo
// são duras e por isso a suite mede bytes:
//
// 1. **CRLF, sempre.** A RFC 5545 §3.1 exige `<CRLF>` como fim de linha, e o
//    parser da RFC é o que mais falha em app novo: alguns calendários recusam LF
//    puro sem avisar. Uma string de template com `\n` parece correta no texto do
//    teste e quebra no Google Calendar.
// 2. **Linhas dobradas em 75 octetos** (§3.1): um título longo sem dobra é a
//    segunda causa de recusa, e a dobra não pode cortar um caractere multibyte.
// 3. **Hora local sem fuso** (`DTSTART:20261107T190000`, sem `Z` nem `TZID`): o
//    Atlas nunca sabe o fuso de quem estuda, e a mesma regra de `core/cartoes.js`
//    (regra 13) vale aqui — quem marca 19:00 no calendário DELA quer o lembrete
//    às 19:00 do calendário DELA. Uma conversão em UTC deslocaria a hora e o
//    evento chegaria na hora errada sem ninguém ter feito nada errado.
//
// O QUE FICA FORA, de propósito: sem `VALARM`. Um alarme dentro do .ics seria a
// notificação que o desenho vetou, só que escrevida no calendário alheio, e não
// há como a pessoa desfazer o que ela mesma aceitou. O arquivo marca o EVENTO; a
// lembrança é do calendário dela.

/** O teto de cada linha, em octetos (RFC 5545 §3.1). Não é o de uma vírgula. */
const LIMITE_LINHA = 75;

/** `aaaa-mm-dd`, o mesmo contrato de `HE_DIA` em core/cartoes.js. */
const HE_DIA = /^\d{4}-\d{2}-\d{2}$/;

/** `hh:mm`, 24h, como o `input type="time"` entrega. */
const HE_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * O escape de TEXTO da RFC 5545 §3.3.11: `\`, `;`, `,` e quebra de linha.
 *
 * `URL` não passa por aqui de propósito: URI não é texto, e escapar uma barra
 * invertida de um endereço quebraria o endereço.
 */
function escaparTexto(bruto) {
  return String(bruto ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/**
 * Dobra a linha em 75 octetos (§3.1), sem cortar caractere multibyte.
 *
 * A conta é em OCTETOS (`ByteLength`), não em caracteres: o Atlas fala
 * português, e um `ã` custa dois bytes. Cortar por caractere produziria a
 * impressão de linha válida no teste e inválida no calendário — a mesma
 * diferença entre parecer certo e ser certo que a trava de bytes veio fechar.
 * A continuação começa com um espaço, e esse espaço não conta no conteúdo.
 */
function dobrar(texto) {
  const enc = new TextEncoder();
  const linha = [];
  let octetos = 0;
  let sai = '';
  for (const caractere of texto) {
    const peso = enc.encode(caractere).length;
    if (octetos + peso > LIMITE_LINHA) {
      sai += `${linha.join('')}\r\n `;
      linha.length = 0;
      octetos = 0;
    }
    linha.push(caractere);
    octetos += peso;
  }
  return sai + linha.join('');
}

/** A linha `CHAVE:valor`, dobrada. */
const linha = (chave, valor) => dobrar(`${chave}:${valor}`);

/** `aaaa-mm-ddThh:mm` local → `20261107T190000` (sem fuso, sem segundos no meio). */
function dataICSDaHoraLocal(dia, hora) {
  return `${dia.replace(/-/g, '')}T${hora.replace(/:/g, '')}00`;
}

/** O instante de criação em UTC, no formato da RFC (§3.3.5 exige o `Z`). */
function stampUTC(agora) {
  const d = agora instanceof Date && !Number.isNaN(agora.getTime()) ? agora : new Date();
  const numero = (v) => String(v).padStart(2, '0');
  return `${d.getUTCFullYear()}${numero(d.getUTCMonth() + 1)}${numero(d.getUTCDate())}`
    + `T${numero(d.getUTCHours())}${numero(d.getUTCMinutes())}${numero(d.getUTCSeconds())}Z`;
}

/**
 * Um sufixo estável derivado do instante, para o `UID`.
 *
 * Não é hash criptográfico nem precisa ser: o `UID` tem de ser único por evento
 * e igual quando o mesmo arquivo for reimportado (§3.8.4.7). Trinta e dois bits
 * de FNV sobre o carimbo bastam, e a data e a hora já estão no resto do UID.
 */
function carimboDoInstante(texto) {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/**
 * O texto do arquivo .ics de uma sessão, ou `null` quando não dá para saber a hora.
 *
 * A recusa é o contrato: dia ou hora inválidos devolvem `null`, e nunca um
 * arquivo meio feito. Quem chama mostra `agenda.semDownload`-da-vida-real ou nem
 * oferece o botão; um `.ics` com `DTSTART` inventado colocaria o compromisso da
 * pessoa em um dia que ela não escolheu, e isso é pior que não baixar nada.
 *
 * @param {{dia: string, hora: string, titulo?: string, url?: string, agora?: Date}} dados
 * @returns {string|null} o texto com CRLF, pronto para virar `text/calendar`
 */
export function icsDaSessao(dados = {}) {
  const dia = String(dados.dia ?? '');
  const hora = String(dados.hora ?? '');
  if (!HE_DIA.test(dia) || !HE_HORA.test(hora)) return null;

  const titulo = escaparTexto(dados.titulo ?? 'Estudar no Atlas');
  const inicio = dataICSDaHoraLocal(dia, hora);
  const stamp = stampUTC(dados.agora);
  // O UID amarra dia + hora + instante: reimportar o mesmo arquivo não duplica,
  // e marcar outra hora gera outro evento (o antigo continua sendo o que a
  // pessoa marcou antes, e apagar é decisão do calendário dela).
  const uid = `atlas-${inicio}-${carimboDoInstante(stamp + inicio)}@atlas`;

  const corpo = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Atlas//PT-BR',
    // CALSCALE é obrigatório no envelope (§4.1.1); GREGORIAN é o único valor.
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    linha('UID', uid),
    linha('DTSTAMP', stamp),
    linha('DTSTART', inicio),
    // ARBITRADO (S19b): 30 minutos. O desenho não diz a duração de uma sessão, e
    // o app não mede quanto ela levou — medir seria a contagem de ausência que o
    // J5 vetou. Uma meia hora é o menor bloco que o calendário mostra sem cobrir
    // a tarde inteira, e a pessoa arrasta no calendário dela se quiser outra.
    linha('DURATION', 'PT30M'),
    linha('SUMMARY', titulo),
  ];

  // `URL` só quando existe: um METHOD:PUBLISH com `URL:` vazio é recusado por
  // parser estrito, e o app offline não tem origem nenhuma para afirmar.
  const url = String(dados.url ?? '');
  if (/^https?:\/\//.test(url)) corpo.push(linha('URL', url));

  corpo.push('END:VEVENT', 'END:VCALENDAR');
  return `${corpo.join('\r\n')}\r\n`;
}

/** O nome do arquivo baixado — a mesma string nos dois lados (tela e trava). */
export const NOME_ARQUIVO = 'atlas-proxima-sessao.ics';
