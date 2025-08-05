// ID ของ Google Sheet ที่จะใช้เก็บข้อมูล
const SPREADSHEET_ID = '1jS6-F3MzKIUVdD9o6pMe9Z5nDNu1ODojW23kHbC_j0c';

// ชื่อชีตที่ต้องการบันทึกข้อมูล
const SUBMISSION_SHEET_NAME = 'Submissions';
const ACTION_SHEET_NAME = 'Actions';
const DATA_SHEET_NAME = 'data';

/**
 * ฟังก์ชันหลักในการแสดงผลหน้าเว็บ
 * @param {object} e - Event parameter
 * @returns {HtmlOutput} - The HTML page to display
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('เครื่องมือวัดความรวดเร็วสำหรับฝั่งปศุสัตว์')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

/**
 * ฟังก์ชันสำหรับ include ไฟล์อื่นๆ เข้ามาใน HTML หลัก
 * @param {string} filename - The name of the file to include
 * @returns {string} - The content of the file
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// วาง 3 ฟังก์ชันนี้แทนที่ getDropdownData เดิม
// ฟังก์ชันที่ 1: ดึงเฉพาะรายชื่อจังหวัดที่ไม่ซ้ำกัน
function getProvinces() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const dataSheet = ss.getSheetByName(DATA_SHEET_NAME);
    if (!dataSheet) return [];
    
    const lastRow = dataSheet.getLastRow();
    if (lastRow < 2) return [];

    const provinceRange = dataSheet.getRange(2, 1, lastRow - 1, 1);
    const provinceValues = provinceRange.getValues().flat();
    const uniqueProvinces = [...new Set(provinceValues)].filter(p => p).sort();
    
    return uniqueProvinces;
  } catch (e) {
    Logger.log(e);
    return { error: e.message };
  }
}

// ฟังก์ชันที่ 2: ดึงอำเภอที่เกี่ยวข้องกับจังหวัดที่เลือก
function getDistricts(selectedProvince) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const dataSheet = ss.getSheetByName(DATA_SHEET_NAME);
    if (!dataSheet || !selectedProvince) return [];

    const allData = dataSheet.getRange(2, 1, dataSheet.getLastRow() - 1, 2).getValues();
    const filteredDistricts = allData
      .filter(row => row[0] === selectedProvince)
      .map(row => row[1]);
      
    const uniqueDistricts = [...new Set(filteredDistricts)].filter(d => d).sort();
    
    return uniqueDistricts;
  } catch (e) {
    Logger.log(e);
    return { error: e.message };
  }
}

// ฟังก์ชันที่ 3: ดึงตำบลที่เกี่ยวข้องกับจังหวัดและอำเภอที่เลือก
function getSubdistricts(selectedProvince, selectedDistrict) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const dataSheet = ss.getSheetByName(DATA_SHEET_NAME);
    if (!dataSheet || !selectedProvince || !selectedDistrict) return [];
    
    const allData = dataSheet.getRange(2, 1, dataSheet.getLastRow() - 1, 3).getValues();
    const filteredSubdistricts = allData
      .filter(row => row[0] === selectedProvince && row[1] === selectedDistrict)
      .map(row => row[2]);
      
    const uniqueSubdistricts = [...new Set(filteredSubdistricts)].filter(s => s).sort();

    return uniqueSubdistricts;
  } catch (e) {
    Logger.log(e);
    return { error: e.message };
  }
}
//================================================================
//   DATA SAVING FUNCTION / ฟังก์ชันบันทึกข้อมูล
//================================================================

// ในไฟล์ Code.gs
// ให้แก้ไขเฉพาะฟังก์ชัน saveData ส่วนฟังก์ชันอื่นให้คงไว้เหมือนเดิม

// ที่ด้านบนสุดของไฟล์ Code.gs
const UPLOAD_FOLDER_ID = "1BGUqniufGEeeIS6Vsz0BMmnr_d0m004T"; // <--- วาง Folder ID ที่คัดลอกมาตรงนี้

//
// ฟังก์ชันอื่นๆ (doGet, include, getProvinces, getDistricts, etc.) ให้คงไว้เหมือนเดิม
//

/**
 * ฟังก์ชันบันทึกข้อมูลฟอร์มและอัปโหลดไฟล์
 * @param {object} formData - ข้อมูลจากฟอร์มทั้งหมด
 * @param {object} fileObject - ข้อมูลไฟล์ที่ถูกแปลงเป็น Base64 (อาจเป็น null)
 * @returns {object} - สถานะการทำงาน
 */
function saveData(formData, fileObject) { // <-- แก้ไขพารามิเตอร์ของฟังก์ชัน
  try {
    // --- 1. อัปโหลดไฟล์ (ถ้ามี) ---
    let fileUrl = ''; // ตัวแปรสำหรับเก็บลิงก์ไฟล์
    if (fileObject && fileObject.base64) {
      const folder = DriveApp.getFolderById(UPLOAD_FOLDER_ID);
      const decoded = Utilities.base64Decode(fileObject.base64, Utilities.Charset.UTF_8);
      const blob = Utilities.newBlob(decoded, fileObject.mimeType, fileObject.name);
      const file = folder.createFile(blob);
      fileUrl = file.getUrl(); // เอาริงก์ของไฟล์ที่อัปโหลดสำเร็จ
    }

    // --- 2. บันทึกข้อมูลลงใน Google Sheet ---
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const submissionSheet = getOrCreateSheet(ss, SUBMISSION_SHEET_NAME);
    const actionSheet = getOrCreateSheet(ss, ACTION_SHEET_NAME);
    const timestamp = new Date();
    const submissionId = "SUB-" + timestamp.getTime();

    // เพิ่มหัวข้อคอลัมน์ "ลิงก์ไฟล์สอบสวนโรค" ถ้ายังไม่มี
    if (submissionSheet.getLastRow() === 0) {
      const submissionHeaders = [
        'Submission ID', 'Timestamp', 'หน่วยงาน', 'ชนิดสัตว์', 'อายุสัตว์', 'สถานะการมีเจ้าของ', 'ประวัติการฉีดวัคซีน', 'วันที่ฉีดวัคซีน',
        'โรค/เหตุการณ์ผิดปกติ', 'ระบุสาเหตุอื่นๆ', 'อาการในสัตว์', 'จังหวัด', 'อำเภอ', 'ตำบล', 'ละติจูด', 'ลองจิจูด',
        'วันที่เกิดความผิดปกติ', 'คำบรรยาย(เกิด)', 'วันที่ตรวจจับ', 'คำบรรยาย(ตรวจจับ)', 'วันที่แจ้งเตือน', 'คำบรรยาย(แจ้งเตือน)',
        'วันที่เริ่มตอบโต้', 'คำบรรยาย(เริ่มตอบโต้)', 'วันที่สอบสวน', 'คำบรรยาย(สอบสวน)', 'วันที่วิเคราะห์', 'คำบรรยาย(วิเคราะห์)',
        'วันที่ส่งตัวอย่าง', 'คำบรรยาย(ส่งตัวอย่าง)', 'วันที่ใช้มาตรการ', 'คำบรรยาย(ใช้มาตรการ)', 'วันที่สื่อสารความเสี่ยง', 'คำบรรยาย(สื่อสาร)',
        'วันที่ประสานงาน', 'คำบรรยาย(ประสานงาน)', 'วันที่ตอบโต้เสร็จสิ้น', 'คำบรรยาย(ตอบโต้เสร็จสิ้น)',
        'ความทันเวลา(ตรวจจับ)', 'เป้าหมาย(ตรวจจับ)', 'ตามเป้า(ตรวจจับ)',
        'ความทันเวลา(แจ้งเตือน)', 'เป้าหมาย(แจ้งเตือน)', 'ตามเป้า(แจ้งเตือน)',
        'ความทันเวลา(ตอบโต้)', 'เป้าหมาย(ตอบโต้)', 'ตามเป้า(ตอบโต้)',
        'ปัจจัยล่าช้า(ตรวจจับ)', 'ปัจจัยสนับสนุน(ตรวจจับ)', 'ปัจจัยล่าช้า(แจ้งเตือน)', 'ปัจจัยสนับสนุน(แจ้งเตือน)',
        'ปัจจัยล่าช้า(ตอบโต้)', 'ปัจจัยสนับสนุน(ตอบโต้)','ลิงก์ไฟล์สอบสวนโรค' // <-- เพิ่มหัวข้อใหม่
      ];
      submissionSheet.appendRow(submissionHeaders);
    }
    
    // เตรียมข้อมูลสำหรับบันทึก 1 แถว
    const submissionRow = [
      submissionId, timestamp, formData.agency, formData.animalSpecies, formData.animalAge, formData.ownershipStatus, formData.vaccinationHistory, formData.vaccinationDate,
      formData.causeSelect, formData.otherCause, formData.symptoms, formData.province, formData.district, formData.subdistrict, formData.latitude, formData.longitude,
      formData.date_of_emergence, formData.desc_emergence, formData.date_of_detection, formData.desc_detection, formData.date_of_notification, formData.desc_notification,
      formData.date_of_response_initiation, formData.desc_response_initiation, formData.date_investigation, formData.desc_investigation, formData.date_epi_analysis, formData.desc_epi_analysis,
      formData.date_lab_sample, formData.desc_lab_sample, formData.date_vet_measure, formData.desc_vet_measure, formData.date_risk_comm, formData.desc_risk_comm,
      formData.date_coordination, formData.desc_coordination, formData.date_of_response_completion, formData.desc_response_completion,
      formData.timeliness_detection_days, formData.target_detection_days, formData.meet_target_detection,
      formData.timeliness_notification_days, formData.target_notification_days, formData.meet_target_notification,
      formData.timeliness_response_days, formData.target_response_days, formData.meet_target_response,
      formData.bottleneck_detection, formData.enabler_detection, formData.bottleneck_notification, formData.enabler_notification,
      formData.bottleneck_response, formData.enabler_response,fileUrl // <-- เพิ่มข้อมูลลิงก์ไฟล์
    ];
    submissionSheet.appendRow(submissionRow);

    // ส่วนของ Action Sheet เหมือนเดิม
    if (actionSheet.getLastRow() === 0) {
      const actionHeaders = [
        'Submission ID', 'Timestamp', 'ประเภทมาตรการ', 'มาตรการที่เสนอ', 'ปัจจัยล่าช้าเป้าหมาย', 
        'หน่วยงานที่รับผิดชอบ', 'วันที่เริ่มต้น', 'วันที่สิ้นสุด', 'โอกาสในการวางแผนฯ'
      ];
      actionSheet.appendRow(actionHeaders);
    }
    if (formData.actions && formData.actions.length > 0) {
      formData.actions.forEach(action => {
        const actionRow = [
          submissionId, timestamp, action.type, action.measure, action.bottleneck,
          action.unit, action.start_date || '', action.end_date || '', action.opportunity || ''
        ];
        actionSheet.appendRow(actionRow);
      });
    }

    return { status: 'success', message: 'บันทึกข้อมูลสำเร็จแล้ว' };

  } catch (e) {
    Logger.log(e);
    return { status: 'error', message: 'เกิดข้อผิดพลาด: ' + e.message };
  }
}

// ฟังก์ชันสำหรับสร้างชีต (ถ้ายังไม่มี)
function getOrCreateSheet(spreadsheet, sheetName) {
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }
  return sheet;
}

/**
 * ดึงข้อมูลโรคและอาการที่สัมพันธ์กันจากชีต DiseaseSymptoms
 * @returns {object} - Object ที่มี key เป็นชื่อโรค และ value เป็น array ของอาการ
 */
function getDiseaseSymptomsData() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('DiseaseSymptoms');
    if (!sheet) {
      // ถ้าไม่พบชีต ให้ส่งกลับเป็น object ว่าง
      Logger.log("Sheet 'DiseaseSymptoms' not found.");
      return {}; 
    }
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
    
    const symptomsMap = {};
    data.forEach(row => {
      const disease = row[0];
      const symptom = row[1];
      if (disease && symptom) {
        if (!symptomsMap[disease]) {
          symptomsMap[disease] = [];
        }
        symptomsMap[disease].push(symptom);
      }
    });
    return symptomsMap;
  } catch (e) {
    Logger.log(e);
    return { error: e.message };
  }
}

