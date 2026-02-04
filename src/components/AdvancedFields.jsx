// AdvancedFields - Hidden section with default values
// Default values are set in invoiceDraft.js:
//   branchId/warehouseId: account defaults, currencyId: 1, currentStatus: 'Draft'
// This component is kept as a no-op for future extensibility if needed.
function AdvancedFields() {
  // Section hidden - all fields use defaults from invoiceDraft state
  return null;
}

export default AdvancedFields;
