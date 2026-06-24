// CDR Excel download — delegates to CDRView.downloadExcel() which uses ExcelJS
const CDRXlsx = {
  async download(headerId) {
    await CDRView.downloadExcel(headerId);
  },
};
