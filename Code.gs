// Điền 3 Script properties trong Project Settings, không sửa mã:
// SPREADSHEET_ID = ID giữa /d/ và /edit trong link Google Sheets
// SHEET_GID = gid của tab đích, ví dụ 800479445
// SHARED_SECRET = khóa riêng ít nhất 32 ký tự, cùng khóa trong extension
const HEADERS = ['Từ vựng','Phiên âm','Nghĩa tiếng Anh','Từ đồng nghĩa / gần nghĩa','Đặt câu'];
function output_(data){return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);}
function normalize_(s){return String(s).normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('de-DE');}
function plain_(s){return /^[\s\u0000-\u0020]*[=+@-]/.test(s)?"'"+s:s;}
function doGet(){return output_({ok:false,error:'Dùng POST từ Deutsch Lens. Không ghi dữ liệu bằng GET.'});}
function doPost(e){
 let lock;
 try{
  const body=e&&e.postData&&e.postData.contents;
  if(!body||body.length>80000)throw Error('Yêu cầu không hợp lệ.');
  const req=JSON.parse(body),p=PropertiesService.getScriptProperties();
  const secret=p.getProperty('SHARED_SECRET'),spreadsheetId=p.getProperty('SPREADSHEET_ID'),gid=p.getProperty('SHEET_GID');
  if(!secret||secret.length<32||!spreadsheetId||!/^\d+$/.test(gid||''))throw Error('Chưa cấu hình đủ Script properties.');
  if(typeof req.secret!=='string'||req.secret!==secret)throw Error('Khóa kết nối không đúng.');
  if(req.spreadsheetId!==spreadsheetId||String(req.sheetId)!==gid)throw Error('Link sheet hoặc gid không khớp cấu hình máy chủ.');
  if(!['test','append'].includes(req.action))throw Error('Thao tác không hợp lệ.');
  const book=SpreadsheetApp.openById(spreadsheetId),sheet=book.getSheets().find(s=>s.getSheetId()===Number(gid));
  if(!sheet)throw Error('Không tìm thấy tab theo gid.');
  const destination={tabName:sheet.getName()};
  if(req.action==='test')return output_({ok:true,...destination});
  if(!Array.isArray(req.row)||req.row.length!==5||req.row.some(v=>typeof v!=='string'||v.length>12000)||!req.row[0].trim())throw Error('Dòng từ vựng không hợp lệ.');
  lock=LockService.getScriptLock();lock.waitLock(15000);
  if(sheet.getLastRow()===0)sheet.getRange(1,1,1,5).setValues([HEADERS]);
  const head=sheet.getRange(1,1,1,5).getDisplayValues()[0];
  if(!HEADERS.every((h,i)=>normalize_(h)===normalize_(head[i])))throw Error('A1:E1 cần đúng 5 tiêu đề trong hướng dẫn. Không thay đổi dữ liệu cũ.');
  const last=sheet.getLastRow();
  if(last>1){const existing=sheet.getRange(2,1,last-1,1).getDisplayValues();const index=existing.findIndex(r=>normalize_(r[0])===normalize_(req.row[0]));if(index>=0)return output_({ok:true,duplicate:true,rowNumber:index+2,...destination});}
  const next=last+1;if(next>sheet.getMaxRows())sheet.insertRowsAfter(sheet.getMaxRows(),1);
  const range=sheet.getRange(next,1,1,5);range.setNumberFormat('@');range.setValues([req.row.map(plain_)]);range.setWrap(true);SpreadsheetApp.flush();
  return output_({ok:true,duplicate:false,rowNumber:next,...destination});
 }catch(err){return output_({ok:false,error:err.message||'Không thể lưu từ vựng.'});}
 finally{if(lock)lock.releaseLock();}
}
