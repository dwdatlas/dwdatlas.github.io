// ============================================================
// SUPABASE CONFIGURATION
// Replace these values with your own Supabase project settings.
// Go to: https://supabase.com → Your Project → Settings → API
// ============================================================
const SUPABASE_URL = localStorage.getItem('sb_url') || '';
const SUPABASE_ANON_KEY = localStorage.getItem('sb_key') || '';

// App constants
const APP_NAME = 'Dulag West District MOOE Dashboard';
const DISTRICT = 'Dulag West District';
const DIVISION = 'Division of Leyte';
const REGION = 'Region VIII';
const BOOKKEEPER = 'JO ANN MARIE P. CAGARA';
const BOOKKEEPER_TITLE = 'ADAS III (Senior Bookkeeper)';

const FUND_TYPES = [
  'Regular MOOE',
  'PSF - Kinder',
  'PSF - Grade 1 Reading',
  'PSF - Grade 1 Math',
  'SBFP - Milk',
  'SBFP - Food',
  'SBFP - NLC',
  'SBFP - Nutriban',
  'SBFP - Additional Operating',
  'K-FELT',
  'ARAL Program',
  'MATATAG',
  'ELLNA',
  'Delivery Support Fund - LRs',
  'Delivery Support Fund - Leveled Reader Mini Book',
  'Delivery Support Fund - Emergency Situation',
  'Delivery Support Fund - Math',
  'LTE-SM Grade 1-3',
  'LTE-SM Grade 4-6',
  'Special Needs Support',
  'Grade 4 Music and Arts',
  'Water Testing',
  'Hauling of Textbooks',
  'COS',
  'Other',
];

const STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'submitted_to_division', label: 'Submitted to Division' },
  { value: 'submitted_to_sou', label: 'Submitted to SOU' },
  { value: 'liquidated', label: 'Liquidated' },
];

const BANKS = ['LBP', 'DBP'];

const UACS_CODES = [
  { code: '5020101000', desc: 'Travelling Expenses-Local' },
  { code: '5020201000', desc: 'Training Expenses' },
  { code: '5020301000', desc: 'Office Supplies Expenses' },
  { code: '5020307000', desc: 'Drugs and Medicines Expenses' },
  { code: '5020309000', desc: 'Fuel, Oil and Lubricant Expenses' },
  { code: '5020399000', desc: 'Other Supplies and Materials Expenses' },
  { code: '5020401000', desc: 'Water Expenses' },
  { code: '5020402000', desc: 'Electricity Expenses' },
  { code: '5020501000', desc: 'Postage and Courier Services' },
  { code: '5020502001', desc: 'Telephone Expenses-Mobile' },
  { code: '5020503000', desc: 'Internet Subscription Expenses' },
  { code: '5020504000', desc: 'Cable, Satellite, Telegraph and Radio Expenses' },
  { code: '5021199000', desc: 'Other Professional Services' },
  { code: '5021202000', desc: 'Janitorial Services' },
  { code: '5021299000', desc: 'Other General Services' },
  { code: '5021303000', desc: 'Security Services' },
  { code: '5021304002', desc: 'Repairs and Maintenance-School Building' },
  { code: '5021305002', desc: 'Repairs and Maintenance-Office Equipment' },
  { code: '5021502000', desc: 'Fidelity Bond Premiums' },
  { code: '5029902000', desc: 'Printing and Publication Expenses' },
];

const RESOURCE_CATEGORIES = [
  { value: 'coa_circular', label: 'COA Circular', css: 'cat-coa' },
  { value: 'deped_order', label: 'DepEd Order', css: 'cat-deped' },
  { value: 'memorandum', label: 'Memorandum', css: 'cat-memo' },
  { value: 'uacs_reference', label: 'UACS Reference', css: 'cat-uacs' },
  { value: 'form_template', label: 'Form / Template', css: 'cat-form' },
  { value: 'google_sheet', label: 'Google Sheet', css: 'cat-sheet' },
  { value: 'google_doc', label: 'Google Doc', css: 'cat-sheet' },
  { value: 'other', label: 'Other', css: 'badge' },
];
