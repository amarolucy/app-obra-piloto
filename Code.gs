/**
 * Recebe os registros do app de campo e grava na planilha (abas "Avanco" e "Custos")
 * e salva as fotos numa pasta do Drive. Cole este código em Extensões > Apps Script
 * de uma planilha Google NOVA e vazia.
 */
var TOKEN = 'troque-esta-senha';          // tem de ser igual ao TOKEN do config.js
var PASTA_FOTOS = 'App de campo - fotos'; // criada automaticamente no seu Drive

var COLUNAS = {
  Avanco: ['id', 'data/hora', 'obra', 'quem', 'servico', 'percentual', 'foto'],
  Custos: ['id', 'data/hora', 'obra', 'quem', 'tipo', 'servico', 'quantidade', 'valor (R$)', 'foto']
};

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var d = JSON.parse(e.postData.contents);
    if (d.token !== TOKEN) return resp({ ok: false, erro: 'token' });
    var nome = d.tipo === 'avanco' ? 'Avanco' : 'Custos';
    var sh = aba(nome);
    // Se o celular reenviar o mesmo registro, não duplica.
    var achou = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 1)
      .createTextFinder(d.id).matchEntireCell(true).findNext();
    if (achou) return resp({ ok: true, repetido: true });

    var link = '';
    if (d.foto) {
      var b64 = String(d.foto).split(',')[1];
      var blob = Utilities.newBlob(Utilities.base64Decode(b64), 'image/jpeg', d.id + '.jpg');
      link = pasta().createFile(blob).getUrl();
    }
    var quando = Utilities.formatDate(new Date(d.ts), 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm');
    if (nome === 'Avanco') {
      sh.appendRow([d.id, quando, d.obra, d.quem, d.servico, d.percentual / 100, link]);
    } else {
      sh.appendRow([d.id, quando, d.obra, d.quem, d.tipoGasto, d.servico, d.quantidade || '', d.valor / 100, link]);
    }
    return resp({ ok: true });
  } catch (err) {
    return resp({ ok: false, erro: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() { return resp({ ok: true, msg: 'App de campo ativo' }); }

function aba(nome) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(nome);
  if (!sh) {
    sh = ss.insertSheet(nome);
    sh.appendRow(COLUNAS[nome]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, COLUNAS[nome].length).setFontWeight('bold').setBackground('#FFC400');
    if (nome === 'Avanco') sh.getRange('F2:F').setNumberFormat('0%');
    else sh.getRange('H2:H').setNumberFormat('R$ #,##0.00');
  }
  return sh;
}

function pasta() {
  var it = DriveApp.getFoldersByName(PASTA_FOTOS);
  return it.hasNext() ? it.next() : DriveApp.createFolder(PASTA_FOTOS);
}

function resp(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
