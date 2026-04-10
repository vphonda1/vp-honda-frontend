import * as XLSX from 'xlsx';

export class ExcelHandler {
  // Import from Excel
  importFromExcel(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          
          const result = {};
          
          workbook.SheetNames.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            result[sheetName] = jsonData;
          });
          
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = (error) => reject(error);
      reader.readAsArrayBuffer(file);
    });
  }

  // Export to Excel
  exportToExcel(data, filename = 'export') {
    const workbook = XLSX.utils.book_new();
    
    Object.keys(data).forEach(sheetName => {
      const worksheet = XLSX.utils.json_to_sheet(data[sheetName]);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    });
    
    XLSX.writeFile(workbook, `${filename}_${Date.now()}.xlsx`);
  }

  // Export single sheet
  exportSingleSheet(data, sheetName, filename) {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, `${filename}_${Date.now()}.xlsx`);
  }
}

export const excelHandler = new ExcelHandler();