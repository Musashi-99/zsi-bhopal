/**
 * Marketplace demo data. Idempotent: safe to run on an existing database (it only ADDS rows) and
 * called automatically at the end of `npm run seed`.
 *
 *   node db/seedMarket.js          add the demo marketplace if it is not there yet
 *   node db/seedMarket.js --force  re-add missing demo rows (existing rows are never overwritten)
 *
 * Everything inserted here is flagged is_demo = 1 so the UI labels it DEMO DATA. Nothing below is a claim about
 * live inventory, live prices, real laboratory results or real government licences.
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const db = require('./db');
const { hashPassword } = require('../services/auth');
const { appendEvent } = require('../services/ledger');

const UPLOADS = path.join(__dirname, '..', 'uploads');
const day = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10); };
const at = (offset, hour = 10) => { const d = new Date(); d.setDate(d.getDate() + offset); d.setHours(hour, 0, 0, 0); return d.toISOString(); };
const NO_LIMIT = 'Not configured — no verified limit is stored';

const ONE_IMAGE = {
  'MC-MAH': '/img/market/cat-mahua.jpg',
  'MC-SAL': '/img/market/cat-sal-leaves.jpg',
  'MC-KEN': '/img/market/cat-kendu.jpg',
  'MC-HON': '/img/market/cat-honey.jpg',
  'MC-LAC': '/img/market/cat-lac.jpg',
  'MC-SAB': '/img/market/cat-sabai.jpg',
  'MC-MED': '/img/market/cat-medicinal.jpg',
  'MC-SED': '/img/market/cat-seeds.jpg',
  'MC-FIB': '/img/market/cat-fibres.jpg',
  'MC-OTH': '/img/market/cat-other.jpg',
  'PR-MAH': '/img/market/cat-mahua.jpg',
  'PR-SAL': '/img/market/cat-sal-leaves.jpg',
  'PR-KEN': '/img/market/cat-kendu.jpg',
  'PR-HON': '/img/market/cat-honey.jpg',
  'PR-LAC': '/img/market/cat-lac.jpg',
  'PR-SAB': '/img/market/cat-sabai.jpg',
  'PR-MED': '/img/market/cat-medicinal.jpg',
  'PR-SSD': '/img/market/cat-seeds.jpg',
  'PR-MSD': '/img/market/cat-seeds.jpg',
  'PR-BWX': '/img/market/beeswax.jpg',
  'PR-TAM': '/img/market/tamarind.jpg',
  'PR-BAM': '/img/market/cat-other.jpg',
};

const CATEGORIES = [
  ['MC-MAH', 'mahua-flowers', 'Mahua Flowers', 'Dried mahua (Madhuca longifolia) flowers collected by forest communities, graded by moisture and foreign matter.', ONE_IMAGE['MC-MAH']],
  ['MC-SAL', 'sal-leaves', 'Sal Leaves', 'Sal (Shorea robusta) leaves, traded as plates, cups and bundles.', ONE_IMAGE['MC-SAL']],
  ['MC-KEN', 'kendu-leaves', 'Kendu Leaves', 'Kendu (Diospyros melanoxylon) leaves, sold in bundles. Trade rules differ by state.', ONE_IMAGE['MC-KEN']],
  ['MC-HON', 'forest-honey', 'Forest Honey', 'Wild and forest-patch honey and hive products such as beeswax.', ONE_IMAGE['MC-HON']],
  ['MC-LAC', 'lac-resins', 'Lac and Natural Resins', 'Stick lac, seed lac and other natural resin products.', ONE_IMAGE['MC-LAC']],
  ['MC-SAB', 'sabai-grass', 'Sabai Grass', 'Sabai (Eulaliopsis binata) grass used for rope, mats and paper pulp.', ONE_IMAGE['MC-SAB']],
  ['MC-MED', 'medicinal-aromatic', 'Medicinal and Aromatic Plants', 'Dried plant material and herbal raw materials recorded with handling details. No therapeutic claims are made.', ONE_IMAGE['MC-MED']],
  ['MC-SED', 'seeds-nuts', 'Forest Seeds and Nuts', 'Sal seeds, mahua seeds and other documented forest seeds and nuts.', ONE_IMAGE['MC-SED']],
  ['MC-FIB', 'natural-fibres', 'Natural Fibres', 'Locally documented natural fibres. Batches appear here as collectors list them.', ONE_IMAGE['MC-FIB']],
  ['MC-OTH', 'other-ntfps', 'Other NTFPs', 'Tamarind, bamboo and other non-timber forest products recorded in the catalogue.', ONE_IMAGE['MC-OTH']],
];

const PERMIT_GENERIC = 'Collection and trade of some non-timber forest produce is regulated and may need permits or transit passes. This catalogue does not state the rules for this product; confirm with the local forest division before trading.';

// [id, name, local_names, category, species, description, unit, units, handling, market_category, season, permissions, image]
const NEW_PRODUCTS = [
  ['PR-KEN', 'Kendu leaves', { bn: 'কেন্দু পাতা', hi: 'तेंदू पत्ता' }, 'Leaf', 'Diospyros melanoxylon', 'Kendu leaf bundles recorded as forest produce. No statutory grade is stored in this demo.', 'bundle', ['bundle', 'kg'], { expected: ['drying', 'storage', 'packaging'], required: ['storage'] }, 'MC-KEN', 'April–June (typical plucking period in many states)', 'In several states kendu leaf collection and trade is government-regulated. This catalogue does not state the position for West Bengal; confirm with the forest department.', ONE_IMAGE['PR-KEN']],
  ['PR-SSD', 'Sal seeds', { bn: 'শাল বীজ', hi: 'साल बीज' }, 'Seed', 'Shorea robusta', 'Dried sal seed batches. Moisture and foreign matter are the attributes buyers usually ask for.', 'kg', ['kg', 'quintal'], { expected: ['drying', 'storage', 'packaging'], required: ['drying', 'storage'] }, 'MC-SED', 'May–June (typical seed-fall period)', PERMIT_GENERIC, ONE_IMAGE['PR-SSD']],
  ['PR-MSD', 'Mahua seeds', { bn: 'মহুয়া বীজ', hi: 'महुआ बीज' }, 'Seed', 'Madhuca longifolia', 'Mahua seed (kernel) batches. This entry is not an edible-oil standard.', 'kg', ['kg', 'quintal'], { expected: ['drying', 'storage'], required: ['storage'] }, 'MC-SED', null, PERMIT_GENERIC, ONE_IMAGE['PR-MSD']],
  ['PR-LAC', 'Lac', { bn: 'লাক্ষা', hi: 'लाख' }, 'Resin', 'Kerria lacca', 'Stick lac and seed lac batches. Lac is an insect-derived resin; this entry does not set a grade.', 'kg', ['kg', 'quintal'], { expected: ['drying', 'storage', 'packaging'], required: ['storage'] }, 'MC-LAC', null, PERMIT_GENERIC, ONE_IMAGE['PR-LAC']],
  ['PR-SAB', 'Sabai grass', { bn: 'সাবাই ঘাস', hi: 'सबई घास' }, 'Grass', 'Eulaliopsis binata', 'Dried sabai grass bundles and bales.', 'kg', ['kg', 'quintal'], { expected: ['drying', 'storage', 'packaging'], required: ['drying'] }, 'MC-SAB', null, PERMIT_GENERIC, ONE_IMAGE['PR-SAB']],
  ['PR-BWX', 'Beeswax', { bn: 'মোম', hi: 'मोम' }, 'Honey', null, 'Beeswax rendered from forest comb. Scientific name is not stated because the source bee species varies.', 'kg', ['kg', 'g'], { expected: ['storage', 'packaging'], required: ['storage'] }, 'MC-HON', null, PERMIT_GENERIC, ONE_IMAGE['PR-BWX']],
  ['PR-TAM', 'Tamarind', { bn: 'তেঁতুল', hi: 'इमली' }, 'Fruit', 'Tamarindus indica', 'Tamarind recorded where locally sourced and documented by the collector.', 'kg', ['kg', 'quintal'], { expected: ['drying', 'storage', 'packaging'], required: ['storage'] }, 'MC-OTH', null, PERMIT_GENERIC, ONE_IMAGE['PR-TAM']],
  ['PR-BAM', 'Bamboo', { bn: 'বাঁশ', hi: 'बाँस' }, 'Bamboo', null, 'Bamboo culms and bamboo-based raw material. Species vary, so no single scientific name is stored.', 'piece', ['piece', 'bundle'], { expected: ['storage', 'packaging'], required: ['storage'] }, 'MC-OTH', null, 'Bamboo from forest land can need transit permits depending on the state and source. Confirm with the local forest division.', ONE_IMAGE['PR-BAM']],
];

const EXISTING_PRODUCT_META = {
  'PR-MAH': { cat: 'MC-MAH', season: 'March–April (typical flowering period)', image: ONE_IMAGE['PR-MAH'] },
  'PR-HON': { cat: 'MC-HON', season: null, image: ONE_IMAGE['PR-HON'] },
  'PR-SAL': { cat: 'MC-SAL', season: null, image: ONE_IMAGE['PR-SAL'] },
  'PR-MED': { cat: 'MC-MED', season: null, image: ONE_IMAGE['PR-MED'] },
};

const PARAMS = {
  'PR-KEN': [['Moisture', '%'], ['Damaged leaves', '%'], ['Appearance', null]],
  'PR-SSD': [['Moisture', '%'], ['Foreign matter', '%'], ['Appearance', null]],
  'PR-MSD': [['Moisture', '%'], ['Foreign matter', '%']],
  'PR-LAC': [['Moisture', '%'], ['Foreign matter', '%'], ['Appearance', null]],
  'PR-SAB': [['Moisture', '%'], ['Foreign matter', '%'], ['Appearance', null]],
  'PR-BWX': [['Moisture', '%'], ['Foreign matter', '%']],
  'PR-TAM': [['Moisture', '%'], ['Foreign matter', '%']],
  'PR-BAM': [['Moisture', '%'], ['Diameter', 'mm']],
  'PR-MAH': [['Appearance', null]], 'PR-HON': [['Appearance', null]], 'PR-SAL': [['Appearance', null]], 'PR-MED': [['Appearance', null]],
};

const NEW_DISTRICTS = [['DT-BIR', 'ST-WB', 'Birbhum'], ['DT-JAL', 'ST-WB', 'Jalpaiguri'], ['DT-ALI', 'ST-WB', 'Alipurduar']];

const EQUIP_FULL = ['Digital moisture meter', 'Platform scale (100 kg)', 'Sieves and sorting trays', 'Raised drying platforms'];
// id, name, district, block, address, accreditation, note, equipment, facilities, contact
const CENTRES = [
  ['CE-PUR', null, null, 'Balarampur block (illustrative)', null, 'active', 'Demo accreditation: inspected against the AranyaValue demo checklist.', EQUIP_FULL, ['Covered drying yard', 'Dry storage room', 'Sorting area'], '9000000011'],
  ['CE-JHA', null, null, 'Jhargram block (illustrative)', null, 'active', 'Demo accreditation: inspected against the AranyaValue demo checklist.', EQUIP_FULL.slice(0, 3), ['Dry storage room', 'Honey settling room'], '9000000012'],
  ['CE-BAN', 'Bankura demo collection centre', 'DT-BAN', 'Bankura block (illustrative)', 'Illustrative address, Bankura', 'active', 'Demo accreditation: inspected against the AranyaValue demo checklist.', EQUIP_FULL, ['Covered drying yard', 'Dry storage room', 'Bundling shed'], '9000000013'],
  ['CE-PME', 'Paschim Medinipur demo collection centre', 'DT-PME', 'Medinipur block (illustrative)', 'Illustrative address, Paschim Medinipur', 'active', 'Demo accreditation: inspected against the AranyaValue demo checklist.', EQUIP_FULL.slice(0, 3), ['Grass drying yard', 'Baling shed', 'Dry storage room'], '9000000014'],
  ['CE-BIR', 'Birbhum demo collection centre', 'DT-BIR', 'Rampurhat block (illustrative)', 'Illustrative address, Birbhum', 'suspended', 'Demo: accreditation suspended pending a re-inspection. The centre cannot show an accredited mark.', EQUIP_FULL.slice(0, 2), ['Dry storage room'], '9000000015'],
  ['CE-JAL', 'Jalpaiguri demo collection centre', 'DT-JAL', 'Jalpaiguri block (illustrative)', 'Illustrative address, Jalpaiguri', 'none', 'Demo: this centre has not applied for AranyaValue accreditation.', ['Platform scale (100 kg)'], ['Open storage shed'], null],
  ['CE-ALI', 'Alipurduar demo collection centre', 'DT-ALI', 'Alipurduar block (illustrative)', 'Illustrative address, Alipurduar', 'active', 'Demo accreditation: inspected against the AranyaValue demo checklist.', EQUIP_FULL.slice(0, 3), ['Dry storage room', 'Honey settling room'], '9000000017'],
];

const NEW_USERS = [
  ['U-PME1', 'Rupali Murmu (demo)', 'rupali@aranya.demo', '9000000021', 'collector123', 'collector', 'DT-PME', null, null],
  ['U-BIR1', 'Santosh Soren (demo)', 'santosh@aranya.demo', '9000000022', 'collector123', 'collector', 'DT-BIR', null, null],
  ['U-JAL1', 'Anjali Oraon (demo)', 'anjali@aranya.demo', '9000000023', 'collector123', 'collector', 'DT-JAL', null, null],
  ['U-ALI1', 'Birsa Toppo (demo)', 'birsa@aranya.demo', '9000000024', 'collector123', 'collector', 'DT-ALI', null, null],
  ['U-CEN3', 'Dipak Mandal (demo centre)', 'centre.bankura@aranya.demo', '9000000013', 'centre12345', 'centre', 'DT-BAN', 'Bankura demo collection centre', 'CE-BAN'],
  ['U-CEN4', 'Mamata Das (demo centre)', 'centre.medinipur@aranya.demo', '9000000014', 'centre12345', 'centre', 'DT-PME', 'Paschim Medinipur demo collection centre', 'CE-PME'],
  ['U-CEN5', 'Gopal Sheikh (demo centre)', 'centre.birbhum@aranya.demo', '9000000015', 'centre12345', 'centre', 'DT-BIR', 'Birbhum demo collection centre', 'CE-BIR'],
  ['U-CEN6', 'Nandini Roy (demo centre)', 'centre.jalpaiguri@aranya.demo', null, 'centre12345', 'centre', 'DT-JAL', 'Jalpaiguri demo collection centre', 'CE-JAL'],
  ['U-CEN7', 'Sunil Lakra (demo centre)', 'centre.alipurduar@aranya.demo', '9000000017', 'centre12345', 'centre', 'DT-ALI', 'Alipurduar demo collection centre', 'CE-ALI'],
];

const CENTRE_USER = { 'CE-PUR': 'U-CEN1', 'CE-JHA': 'U-CEN2', 'CE-BAN': 'U-CEN3', 'CE-PME': 'U-CEN4', 'CE-BIR': 'U-CEN5', 'CE-JAL': 'U-CEN6', 'CE-ALI': 'U-CEN7' };

// Listing prices for batches that already existed before the marketplace: [batch, price, unit, min, packaging, images]
const EXISTING_LISTINGS = [
  ['BT-M1', 150, 'kg', 25, 'Jute bags, 20 kg', ['/img/mahua.jpg', '/img/drying.jpg', '/img/packaging.jpg']],
  ['BT-M2', 142, 'kg', 40, 'Jute sacks, 40 kg', ['/img/mahua.jpg', '/img/flower.jpg']],
  ['BT-H1', 410, 'kg', 2, 'Food-grade tubs, 5 kg', ['/img/honey-1.jpg', '/img/honey-2.jpg']],
  ['BT-H2', 365, 'kg', 2, 'Steel container, 12 kg', ['/img/honey-3.jpg', '/img/honey-1.jpg']],
  ['BT-S1', 3, 'piece', 100, 'Tied bundles of 100', ['/img/market/sal-leaves.jpg', '/img/packaging.jpg']],
  ['BT-D1', 110, 'kg', 5, 'Cloth bags', ['/img/medicinal.jpg']],
  ['BT-H3', 395, 'kg', 2, 'Plastic bucket, 8 kg', ['/img/honey-2.jpg', '/img/honey-1.jpg']],
  ['BT-S2', 2.6, 'piece', 100, 'Stacked bundles', ['/img/market/sal-leaves.jpg']],
  ['BT-D2', 150, 'kg', 5, 'Cloth bags, 5 kg', ['/img/medicinal.jpg', '/img/drying.jpg']],
];

// id, code, product, collector, centre, district, local, variety, qty, unit, collected(offset), area, method, source, status,
// price, min, packaging, images, description
const BATCHES = [
  ['BT-N01', 'AV-WB-MAH-0011', 'PR-MAH', 'U-MINA', 'CE-PUR', 'DT-PUR', 'Mahua', 'Dried flowers', 320, 'kg', -9, 'Balarampur block (illustrative)', 'Hand picked', 'community forest', 'verified', 145, 25, 'Jute sacks, 40 kg', ['/img/mahua.jpg', '/img/drying.jpg', '/img/packaging.jpg'], 'Sun-dried on raised mats and checked at the centre. Sorted to remove stalks and debris.'],
  ['BT-N02', 'AV-WB-MAH-0012', 'PR-MAH', 'U-BIR1', 'CE-BIR', 'DT-BIR', 'Mahua', 'Dried flowers', 150, 'kg', -14, 'Rampurhat block (illustrative)', 'Hand picked', 'community forest', 'verified_with_limitations', 138, 20, 'Jute bags, 25 kg', ['/img/mahua.jpg', '/img/flower.jpg'], 'Dried flowers from the Birbhum catchment. Officer approval carries a recorded limitation.'],
  ['BT-N03', 'AV-WB-SAL-0013', 'PR-SAL', 'U-BASA', 'CE-BAN', 'DT-BAN', 'Sal pata', 'Plate grade', 1200, 'piece', -7, 'Bankura block (illustrative)', 'Hand plucked', 'community forest', 'verified', 2.8, 200, 'Bundles of 100', ['/img/market/sal-leaves.jpg', '/img/packaging.jpg'], 'Sal leaves bundled for plate making. Damage percentage checked at the centre.'],
  ['BT-N04', 'AV-WB-SAL-0014', 'PR-SAL', 'U-PME1', 'CE-PME', 'DT-PME', 'Sal pata', 'Cup grade', 1800, 'piece', -10, 'Medinipur block (illustrative)', 'Hand plucked', 'community forest', 'pending_verification', 2.5, 200, 'Bundles of 100', ['/img/market/sal-leaves.jpg'], 'Waiting for officer review.'],
  ['BT-N05', 'AV-WB-HON-0015', 'PR-HON', 'U-SUKU', 'CE-JHA', 'DT-JHA', 'Madhu', 'Multifloral', 45, 'kg', -5, 'Jhargram block (illustrative)', 'Wild comb', 'declared forest patch', 'verified', 380, 5, 'Glass jars, 1 kg', ['/img/honey-1.jpg', '/img/honey-2.jpg', '/img/honey-3.jpg'], 'Multifloral forest honey, strained at the centre. Laboratory moisture result on file (demo).'],
  ['BT-N06', 'AV-WB-HON-0016', 'PR-HON', 'U-ALI1', 'CE-ALI', 'DT-ALI', 'Madhu', 'Wild comb', 30, 'kg', -12, 'Alipurduar block (illustrative)', 'Wild comb', 'declared forest patch', 'pending_verification', 420, 3, 'Food-grade tubs, 5 kg', ['/img/honey-2.jpg', '/img/honey-1.jpg'], 'Wild comb honey awaiting officer review.'],
  ['BT-N07', 'AV-WB-LAC-0017', 'PR-LAC', 'U-MINA', 'CE-PUR', 'DT-PUR', 'Lakkha', 'Stick lac', 210, 'kg', -16, 'Balarampur block (illustrative)', 'Cut from host branches', 'community forest', 'verified', 290, 20, 'Gunny bags, 50 kg', ['/img/market/lac.jpg', '/img/packaging.jpg'], 'Stick lac scraped and dried. Officer observation recorded on appearance.'],
  ['BT-N08', 'AV-WB-LAC-0018', 'PR-LAC', 'U-BASA', 'CE-BAN', 'DT-BAN', 'Lakkha', 'Seed lac', 95, 'kg', -8, 'Bankura block (illustrative)', 'Cut from host branches', 'community forest', 'pending_verification', 340, 10, 'Gunny bags, 25 kg', ['/img/market/lac.jpg'], 'Seed lac awaiting officer review.'],
  ['BT-N09', 'AV-WB-SAB-0019', 'PR-SAB', 'U-PME1', 'CE-PME', 'DT-PME', 'Sabai ghas', 'Dry bundles', 850, 'kg', -20, 'Medinipur block (illustrative)', 'Hand cut', 'community land', 'verified_with_limitations', 42, 50, 'Bales, 25 kg', ['/img/market/sabai-grass.jpg', '/img/drying.jpg'], 'Dried sabai grass baled at the centre. Approved with a limitation on moisture evidence.'],
  ['BT-N10', 'AV-WB-KEN-0020', 'PR-KEN', 'U-SUKU', 'CE-JHA', 'DT-JHA', 'Kendu pata', 'Bundles of 50', 4000, 'bundle', -11, 'Jhargram block (illustrative)', 'Hand plucked', 'community forest', 'pending_verification', 3.4, 500, 'Bundles of 50 leaves', ['/img/market/kendu-leaves.jpg'], 'Kendu leaf bundles awaiting officer review. Check the permissions note before trading.'],
  ['BT-N11', 'AV-WB-KEN-0021', 'PR-KEN', 'U-MINA', 'CE-PUR', 'DT-PUR', 'Kendu pata', 'Bundles of 50', 2500, 'bundle', -18, 'Balarampur block (illustrative)', 'Hand plucked', 'community forest', 'verified', 3.6, 500, 'Bundles of 50 leaves', ['/img/market/kendu-leaves.jpg', '/img/packaging.jpg'], 'Kendu leaf bundles, sorted and counted at the centre.'],
  ['BT-N12', 'AV-WB-SSD-0022', 'PR-SSD', 'U-BASA', 'CE-BAN', 'DT-BAN', 'Sal bij', 'Dried seeds', 600, 'kg', -13, 'Bankura block (illustrative)', 'Collected from the forest floor', 'community forest', 'verified', 24, 50, 'Jute sacks, 40 kg', ['/img/seeds.jpg', '/img/drying.jpg'], 'Dried sal seeds, cleaned of husk and foreign matter.'],
  ['BT-N13', 'AV-WB-SSD-0023', 'PR-SSD', 'U-SUKU', 'CE-JHA', 'DT-JHA', 'Sal bij', 'Dried seeds', 380, 'kg', -9, 'Jhargram block (illustrative)', 'Collected from the forest floor', 'community forest', 'needs_info', 23, 50, 'Jute sacks, 40 kg', ['/img/seeds.jpg'], 'The officer asked for a drying record. Details may change.'],
  ['BT-N14', 'AV-WB-MSD-0024', 'PR-MSD', 'U-SUKU', 'CE-JHA', 'DT-JHA', 'Mahua bij', 'Dried seeds', 400, 'kg', -6, 'Jhargram block (illustrative)', 'Collected from the forest floor', 'community forest', 'pending_verification', 55, 50, 'Jute sacks, 40 kg', ['/img/seeds.jpg', '/img/mahua.jpg'], 'Mahua seeds awaiting officer review.'],
  ['BT-N15', 'AV-WB-MED-0025', 'PR-MED', 'U-SUKU', 'CE-JHA', 'DT-JHA', 'Kalmegh', 'Andrographis paniculata', 60, 'kg', -10, 'Jhargram block (illustrative)', 'Hand cut aerial parts', 'farm edge declared', 'verified', 160, 5, 'Cloth bags, 10 kg', ['/img/medicinal.jpg', '/img/drying.jpg'], 'Shade-dried plant material. Laboratory moisture result on file (demo). No therapeutic claim is made.'],
  ['BT-N16', 'AV-WB-TAM-0026', 'PR-TAM', 'U-BIR1', 'CE-BIR', 'DT-BIR', 'Tentul', 'Cleaned pods', 500, 'kg', -22, 'Rampurhat block (illustrative)', 'Hand picked', 'village trees', 'suspended', 95, 25, 'Jute sacks, 50 kg', ['/img/market/tamarind.jpg'], 'This batch was suspended after an officer review (demo).'],
  ['BT-N17', 'AV-WB-BAM-0027', 'PR-BAM', 'U-JAL1', 'CE-JAL', 'DT-JAL', 'Bans', 'Culms, 3 m', 900, 'piece', -15, 'Jalpaiguri block (illustrative)', 'Cut and trimmed', 'community plantation', 'pending_verification', 85, 50, 'Bundles of 25 culms', ['/img/market/bamboo.jpg'], 'Bamboo culms awaiting officer review. Check transit-permit requirements.'],
  ['BT-N18', 'AV-WB-BWX-0028', 'PR-BWX', 'U-ALI1', 'CE-ALI', 'DT-ALI', 'Mom', 'Blocks', 25, 'kg', -9, 'Alipurduar block (illustrative)', 'Rendered from comb', 'declared forest patch', 'verified', 520, 2, 'Wrapped blocks, 1 kg', ['/img/market/beeswax.jpg'], 'Beeswax blocks rendered at the centre.'],
  ['BT-N19', 'AV-WB-SAL-0029', 'PR-SAL', 'U-PME1', 'CE-PME', 'DT-PME', 'Sal pata', 'Plate grade', 700, 'piece', -25, 'Medinipur block (illustrative)', 'Hand plucked', 'community forest', 'rejected', 2.2, 100, 'Loose bundles', ['/img/market/sal-leaves.jpg'], 'Rejected at review (demo): damaged-leaf count was not supported by evidence.'],
];

// batch, parameter, value, text, unit, source ('self_reported'|'measured'|'simulated'), by ('collector'|'centre'|<user id>), method
const MEASURES = [
  ['BT-N01', 'Moisture', 9.5, null, '%', 'measured', 'centre', 'Digital moisture meter'],
  ['BT-N01', 'Foreign matter', 1.2, null, '%', 'self_reported', 'collector', 'Hand sorting estimate'],
  ['BT-N01', 'Appearance', null, 'Uniform amber-brown, no visible mould', null, 'self_reported', 'collector', 'Visual'],
  ['BT-N02', 'Moisture', 11, null, '%', 'self_reported', 'collector', 'Pin sample estimate'],
  ['BT-N03', 'Damaged leaves', 2.5, null, '%', 'measured', 'centre', 'Counted from 3 sample bundles'],
  ['BT-N03', 'Appearance', null, 'Clean, uniform size, no tears', null, 'measured', 'centre', 'Visual check at centre'],
  ['BT-N04', 'Damaged leaves', 4, null, '%', 'self_reported', 'collector', 'Counted from one bundle'],
  ['BT-N05', 'Moisture', 19.2, null, '%', 'measured', 'centre', 'Refractometer at the centre'],
  ['BT-N05', 'Appearance', null, 'Golden-amber, clear, no crystallisation', null, 'measured', 'centre', 'Visual check at centre'],
  ['BT-N06', 'Moisture', 21, null, '%', 'simulated', 'collector', 'Simulated demonstration value'],
  ['BT-N07', 'Moisture', 6.8, null, '%', 'measured', 'centre', 'Digital moisture meter'],
  ['BT-N07', 'Foreign matter', 3.1, null, '%', 'self_reported', 'collector', 'Sieve estimate'],
  ['BT-N08', 'Moisture', 7.4, null, '%', 'self_reported', 'collector', 'Collector reading'],
  ['BT-N09', 'Moisture', 12, null, '%', 'self_reported', 'collector', 'Hand-feel estimate'],
  ['BT-N10', 'Damaged leaves', 5, null, '%', 'self_reported', 'collector', 'Counted from one bundle'],
  ['BT-N11', 'Damaged leaves', 3, null, '%', 'measured', 'centre', 'Counted from 3 sample bundles'],
  ['BT-N12', 'Moisture', 8.2, null, '%', 'measured', 'centre', 'Digital moisture meter'],
  ['BT-N12', 'Foreign matter', 0.8, null, '%', 'self_reported', 'collector', 'Winnowing estimate'],
  ['BT-N14', 'Moisture', 10.5, null, '%', 'self_reported', 'collector', 'Collector reading'],
  ['BT-N15', 'Moisture', 8.9, null, '%', 'measured', 'centre', 'Digital moisture meter'],
  ['BT-N15', 'Foreign matter', 1.1, null, '%', 'self_reported', 'collector', 'Sorting note'],
  ['BT-N16', 'Moisture', 16, null, '%', 'self_reported', 'collector', 'Collector reading'],
  ['BT-N17', 'Diameter', 62, null, 'mm', 'self_reported', 'collector', 'Caliper, mean of 5 culms'],
  ['BT-N18', 'Foreign matter', 0.5, null, '%', 'self_reported', 'collector', 'Visual'],
  ['BT-N19', 'Damaged leaves', 12, null, '%', 'self_reported', 'collector', 'Counted from one bundle'],
];

// batch, parameter, value, text, unit, source, method, ref
const INSPECTIONS = [
  ['BT-N01', 'Moisture', 9.3, null, '%', 'laboratory', 'Oven-dry method (demo record)', 'DEMO-LAB-2026-001'],
  ['BT-N05', 'Moisture', 19.0, null, '%', 'laboratory', 'Refractometric method (demo record)', 'DEMO-LAB-2026-002'],
  ['BT-N15', 'Moisture', 8.7, null, '%', 'laboratory', 'Oven-dry method (demo record)', 'DEMO-LAB-2026-003'],
  ['BT-N03', 'Moisture', 10.1, null, '%', 'instrument', 'Calibrated handheld meter', null],
  ['BT-N07', 'Appearance', null, 'Hard resin, uniform dark red, free of insect debris', null, 'officer_observation', 'Officer visual inspection', null],
];

// Officer decisions in order: batch, status, summary, limitations, days ago
const VERIFICATIONS = [
  ['BT-N01', 'verified', 'Centre moisture reading and laboratory result are on file and agree. Handling steps are recorded.', null, 6],
  ['BT-N02', 'verified_with_limitations', 'Approved on the evidence on file. The moisture reading is collector-estimated only.', 'No instrument or laboratory moisture result. The centre accreditation is under review.', 9],
  ['BT-N03', 'verified', 'Damage count and calibrated meter reading are on file.', null, 5],
  ['BT-N05', 'verified', 'Centre refractometer reading and laboratory moisture result are on file (demo).', null, 3],
  ['BT-N07', 'verified', 'Officer inspected the lot at the centre. Appearance recorded.', null, 10],
  ['BT-N09', 'verified_with_limitations', 'Approved on handling records. Moisture is a hand-feel estimate.', 'Moisture is not instrument-measured.', 14],
  ['BT-N11', 'verified', 'Centre damage count and packaging record are on file.', null, 12],
  ['BT-N12', 'verified', 'Centre moisture reading is on file and handling is recorded.', null, 8],
  ['BT-N13', 'needs_info', 'Please add the drying record (method and dates) and resubmit.', null, 2],
  ['BT-N15', 'verified', 'Centre reading and laboratory moisture result are on file (demo).', null, 7],
  ['BT-N16', 'verified', 'Approved on the evidence on file at the time.', null, 18],
  ['BT-N16', 'suspended', 'Suspended after a buyer complaint about storage conditions was referred for inspection. Do not rely on earlier results.', null, 4],
  ['BT-N18', 'verified', 'Packaging and foreign-matter record are on file.', null, 6],
  ['BT-N19', 'rejected', 'The damaged-leaf percentage could not be supported by evidence and the handling record is incomplete.', null, 20],
];

const HANDLING = [
  ['BT-N01', 'drying', 'Sun drying on raised mats', 'Centre yard', -8, -5, 'centre'],
  ['BT-N01', 'storage', 'Jute sacks, raised platform', 'Purulia demo centre', -5, null, 'centre'],
  ['BT-N01', 'packaging', 'Jute sacks, 40 kg', 'Purulia demo centre', -5, -5, 'centre'],
  ['BT-N03', 'packaging', 'Tied bundles of 100', 'Bankura demo centre', -6, -6, 'centre'],
  ['BT-N03', 'storage', 'Dry room, off the floor', 'Bankura demo centre', -6, null, 'centre'],
  ['BT-N05', 'storage', 'Food-grade container, covered', 'Jhargram demo centre', -4, null, 'centre'],
  ['BT-N05', 'packaging', 'Glass jars, 1 kg', 'Jhargram demo centre', -4, -4, 'centre'],
  ['BT-N07', 'drying', 'Shade drying', 'Centre yard', -14, -10, 'centre'],
  ['BT-N07', 'storage', 'Gunny bags, dry room', 'Purulia demo centre', -10, null, 'centre'],
  ['BT-N09', 'drying', 'Sun drying', 'Medinipur yard', -19, -15, 'collector'],
  ['BT-N09', 'packaging', 'Baled, 25 kg', 'Paschim Medinipur demo centre', -14, -14, 'centre'],
  ['BT-N11', 'storage', 'Bundles stacked indoors', 'Purulia demo centre', -17, null, 'centre'],
  ['BT-N12', 'drying', 'Sun drying on tarpaulin', 'Bankura yard', -12, -9, 'collector'],
  ['BT-N12', 'storage', 'Jute sacks, dry room', 'Bankura demo centre', -9, null, 'centre'],
  ['BT-N15', 'drying', 'Shade drying', 'Jhargram yard', -9, -6, 'collector'],
  ['BT-N15', 'storage', 'Cloth bags, dry room', 'Jhargram demo centre', -6, null, 'centre'],
  ['BT-N16', 'storage', 'Open shed (flagged in review)', 'Birbhum demo centre', -21, null, 'collector'],
  ['BT-N18', 'packaging', 'Wrapped blocks, 1 kg', 'Alipurduar demo centre', -8, -8, 'centre'],
  ['BT-N18', 'storage', 'Cool dry room', 'Alipurduar demo centre', -8, null, 'centre'],
  ['BT-N04', 'storage', 'Stacked indoors', 'Medinipur home store', -9, null, 'collector'],
  ['BT-N10', 'storage', 'Bundles stacked indoors', 'Jhargram home store', -10, null, 'collector'],
];

function pdfFor(file, lines) {
  return new Promise((resolve) => {
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 54 });
    const out = fs.createWriteStream(path.join(UPLOADS, file));
    doc.pipe(out);
    doc.fontSize(10).fillColor('#b45309').text('DEMO DATA — NOT A REAL LABORATORY CERTIFICATE', { align: 'center' });
    doc.moveDown().fontSize(18).fillColor('#173F2B').text('Illustrative laboratory result summary', { align: 'center' });
    doc.moveDown();
    doc.fontSize(11).fillColor('#343A35');
    for (const l of lines) doc.text(l).moveDown(0.4);
    doc.moveDown().fontSize(9).fillColor('#666').text('Created by the AranyaValue demo seed to show how a public lab document appears. No laboratory produced it and it must not be relied on.');
    doc.end();
    out.on('finish', resolve);
  });
}

function syncProductImages() {
  const cat = db.prepare('UPDATE market_categories SET image = ? WHERE id = ?');
  const prod = db.prepare('UPDATE products SET image = ? WHERE id = ?');
  for (const [id, image] of Object.entries(ONE_IMAGE)) (id.startsWith('MC-') ? cat : prod).run(image, id);
  const rows = db.prepare('SELECT l.batch_id, p.image FROM market_listings l JOIN batches b ON b.id = l.batch_id JOIN products p ON p.id = b.product_id').all();
  const upd = db.prepare('UPDATE market_listings SET images_json = ? WHERE batch_id = ?');
  for (const r of rows) if (r.image) upd.run(JSON.stringify([r.image]), r.batch_id);
}

async function run({ force = false } = {}) {
  syncProductImages();
  if (db.prepare("SELECT 1 FROM market_categories WHERE id = 'MC-MAH'").get() && !force) {
    console.log('Marketplace demo data already present. Use --force to add any missing rows.');
    return false;
  }
  if (!fs.existsSync(UPLOADS)) fs.mkdirSync(UPLOADS, { recursive: true });
  const ts = new Date().toISOString();
  const ledger = [];

  db.transaction(() => {
    for (const [id, state, name] of NEW_DISTRICTS) db.prepare('INSERT OR IGNORE INTO districts (id, state_id, name, is_active) VALUES (?, ?, ?, 1)').run(id, state, name);

    CATEGORIES.forEach(([id, slug, name, description, image], i) => {
      db.prepare('INSERT OR IGNORE INTO market_categories (id, slug, name, description, image, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)').run(id, slug, name, description, image, i);
    });

    for (const [id, meta] of Object.entries(EXISTING_PRODUCT_META)) {
      db.prepare('UPDATE products SET market_category_id = COALESCE(market_category_id, ?), season = COALESCE(season, ?), image = COALESCE(image, ?), permissions_note = COALESCE(permissions_note, ?), is_demo = 1 WHERE id = ?')
        .run(meta.cat, meta.season, meta.image, PERMIT_GENERIC, id);
    }
    for (const p of NEW_PRODUCTS) {
      db.prepare(`INSERT OR IGNORE INTO products (id, name, local_names, category, species_name, description, default_unit, units_json, handling_json, is_active, market_category_id, season, permissions_note, image, is_demo)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, 1)`)
        .run(p[0], p[1], JSON.stringify(p[2]), p[3], p[4], p[5], p[6], JSON.stringify(p[7]), JSON.stringify(p[8]), p[9], p[10], p[11], p[12]);
      db.prepare('INSERT OR IGNORE INTO product_states (product_id, state_id) VALUES (?, ?)').run(p[0], 'ST-WB');
      db.prepare(`INSERT OR IGNORE INTO quality_profiles (id, product_id, name, version, region, source_name, source_url, effective_date, notes, illustrative)
        VALUES (?, ?, ?, 'demo-1', 'West Bengal demonstration', 'AranyaValue demonstration profile', NULL, ?, 'Thresholds are not filled in. A blank limit means not configured. This is not a statutory standard.', 1)`)
        .run(`QP-${p[0].slice(3)}`, p[0], `${p[1]} attribute list`, day(0));
    }
    // attribute lists: add the parameters each product should show (names only; no limits are invented)
    for (const [productId, list] of Object.entries(PARAMS)) {
      const profile = db.prepare('SELECT id FROM quality_profiles WHERE product_id = ? ORDER BY id LIMIT 1').get(productId);
      if (!profile) continue;
      list.forEach(([name, unit], i) => {
        const exists = db.prepare('SELECT 1 FROM quality_parameters WHERE profile_id = ? AND name = ?').get(profile.id, name);
        if (exists) return;
        db.prepare(`INSERT INTO quality_parameters (id, profile_id, name, unit, data_type, min_value, max_value, required, source_name, sort_order)
          VALUES (?, ?, ?, ?, ?, NULL, NULL, 0, ?, ?)`).run(`PA-${productId.slice(3)}-${i + 1}-${name.slice(0, 3).toUpperCase()}`, profile.id, name, unit, unit ? 'number' : 'text', NO_LIMIT, 10 + i);
      });
    }

    for (const [id, name, email, phone, password, role, district, org, centre] of NEW_USERS) {
      db.prepare(`INSERT OR IGNORE INTO users (id, name, email, phone, password_hash, role, preferred_language, state_id, district_id, organisation, centre_id, active, is_demo, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'bn', 'ST-WB', ?, ?, ?, 1, 1, ?)`).run(id, name, email, phone, hashPassword(password), role, district, org, centre, ts);
    }

    // Centres. The first two already exist and are only enriched; the rest are new demo centres.
    for (const [id, name, district, block, address, acc, note, equipment, facilities, phone] of CENTRES) {
      const manager = CENTRE_USER[id];
      if (name) {
        db.prepare(`INSERT OR IGNORE INTO centres (id, name, state_id, district_id, manager_user_id, address, is_demo, coverage_note)
          VALUES (?, ?, 'ST-WB', ?, ?, ?, 1, 'Not a real collection centre. Demonstration record.')`).run(id, name, district, manager, address);
      }
      db.prepare(`UPDATE centres SET block_name = COALESCE(block_name, ?), accreditation_status = ?, accreditation_note = ?, accreditation_updated_at = ?,
          equipment_json = ?, facilities_json = ?, contact_phone = ?, contact_public = ?, image = COALESCE(image, ?) WHERE id = ?`)
        .run(block, acc, note, ts, JSON.stringify(equipment), JSON.stringify(facilities), phone, phone ? 1 : 0, '/img/forest.jpg', id);
    }

    const roleUser = (batch, who) => (who === 'centre' ? (CENTRE_USER[batch.centre_id] || batch.collector_id) : who === 'collector' ? batch.collector_id : who);

    const insertedBatches = [];
    for (const b of BATCHES) {
      const [id, code, product, collector, centre, district, local, variety, qty, unit, off, area, method, source, status] = b;
      if (db.prepare('SELECT 1 FROM batches WHERE id = ?').get(id)) continue;
      db.prepare(`INSERT INTO batches (id, batch_code, product_id, collector_id, centre_id, state_id, district_id, local_name, variety, grade_label, quantity, unit,
          collection_date, collection_area, collection_method, source_type, source_declaration, status, public_share, is_demo, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'ST-WB', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Declared by the collector. Not independently verified.', ?, 1, 1, ?, ?)`)
        .run(id, code, product, collector, centre, district, local, variety, variety, qty, unit, day(off), area, method, source, status, at(off), at(off + 3));
      db.prepare('INSERT OR IGNORE INTO inventory (id, centre_id, batch_id, quantity, unit, location, status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(`INV-${id}`, centre, id, qty, unit, 'Demo store room', status === 'verified' ? 'ready' : 'stored', ts);
      insertedBatches.push({ id, collector_id: collector, centre_id: centre, status });
      ledger.push([id, 'BATCH_CREATED', collector, { demo: true }]);
      if (status !== 'draft') ledger.push([id, 'ASSESSMENT_SUBMITTED', collector, { demo: true }]);
    }
    const byId = Object.fromEntries(BATCHES.map((b) => [b[0], { id: b[0], collector_id: b[3], centre_id: b[4] }]));

    for (const [batchId, kind, method, location, startOff, endOff, who] of HANDLING) {
      const b = byId[batchId];
      if (!insertedBatches.find((x) => x.id === batchId)) continue;
      db.prepare('INSERT INTO handling_records (id, batch_id, kind, method, location, start_date, end_date, recorded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(`HN-MK-${Math.random().toString(36).slice(2, 8).toUpperCase()}`, batchId, kind, method, location, day(startOff), endOff == null ? null : day(endOff), roleUser(b, who), at(startOff));
    }

    MEASURES.forEach(([batchId, name, value, textValue, unit, source, who, method], i) => {
      const b = byId[batchId];
      if (!insertedBatches.find((x) => x.id === batchId)) return;
      db.prepare(`INSERT INTO measurements (id, batch_id, parameter_name, value, text_value, unit, measured_at, method, evidence_source, verified, recorded_by, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`)
        .run(`MS-MK-${i + 1}`, batchId, name, value, textValue, unit, day(-4), method, source, roleUser(b, who), source === 'simulated' ? 'Simulated demonstration value. Not a laboratory result.' : 'Demo record.', ts);
      ledger.push([batchId, 'MEASUREMENT_RECORDED', roleUser(b, who), { parameter: name, demo: true }]);
    });

    INSPECTIONS.forEach(([batchId, name, value, textValue, unit, source, method, ref], i) => {
      db.prepare(`INSERT INTO inspection_records (id, batch_id, parameter_name, value, text_value, unit, method, tested_on, evidence_source, reference_standard, lab_report_ref, remarks, inspector_id, version, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 'Demo record: illustrative value, not a real test.', 'U-INS', 1, ?)`)
        .run(`IR-MK-${i + 1}`, batchId, name, value, textValue, unit, method, day(-4), source, ref, ts);
    });

    for (const [batchId, status, summary, limits, ago] of VERIFICATIONS) {
      if (!insertedBatches.find((x) => x.id === batchId)) continue;
      db.prepare('INSERT INTO verifications (id, batch_id, inspector_id, status, summary, limitations, created_at) VALUES (?, ?, \'U-INS\', ?, ?, ?, ?)')
        .run(`VF-MK-${Math.random().toString(36).slice(2, 8).toUpperCase()}`, batchId, status, summary, limits, at(-ago, 15));
      ledger.push([batchId, 'ASSESSMENT_REVIEWED', 'U-INS', { status, officer_review: true, demo: true }]);
    }
    db.prepare(`INSERT OR IGNORE INTO rejections (id, batch_id, actor_id, category, explanation, measurement_ref, corrective_action, reassessment_needed, created_at)
      VALUES ('RJ-MK-1', 'BT-N19', 'U-INS', 'evidence_insufficient', 'The damaged-leaf percentage could not be supported by evidence.', 'Damaged leaves', 'Add a photograph and a counted sample, then resubmit.', 1, ?)`).run(at(-20, 15));

    // Listings: pricing + packaging live in market_listings, the batch itself is untouched.
    for (const [batchId, price, unit, min, packaging, images] of EXISTING_LISTINGS) {
      if (!db.prepare('SELECT 1 FROM batches WHERE id = ?').get(batchId)) continue;
      db.prepare(`INSERT OR IGNORE INTO market_listings (batch_id, listed, indicative_price, price_unit, price_updated_at, min_order_qty, packaging, description, images_json, is_demo, created_at, updated_at, updated_by)
        VALUES (?, 1, ?, ?, ?, ?, ?, NULL, ?, 1, ?, ?, 'U-ADM')`).run(batchId, price, unit, at(-3), min, packaging, JSON.stringify(images), ts, ts);
    }
    BATCHES.forEach((b, i) => {
      db.prepare(`INSERT OR IGNORE INTO market_listings (batch_id, listed, indicative_price, price_unit, price_updated_at, min_order_qty, packaging, description, images_json, is_demo, created_at, updated_at, updated_by)
        VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`).run(b[0], b[15], b[9], at(-2 - (i % 5)), b[16], b[17], b[19], JSON.stringify(b[18]), at(-i, 9), ts, b[3]);
    });

    seedBuyerActivity(ts);
  })();

  // Public demo lab summaries (PDF) for the three lab-tested batches.
  const labDocs = [
    ['BT-N01', 'demo-lab-report-001.pdf', 'Mahua flowers, batch AV-WB-MAH-0011', 'Moisture: 9.3 % (oven-dry method, illustrative)', 'Report reference: DEMO-LAB-2026-001'],
    ['BT-N05', 'demo-lab-report-002.pdf', 'Forest honey, batch AV-WB-HON-0015', 'Moisture: 19.0 % (refractometric method, illustrative)', 'Report reference: DEMO-LAB-2026-002'],
    ['BT-N15', 'demo-lab-report-003.pdf', 'Dried plant material, batch AV-WB-MED-0025', 'Moisture: 8.7 % (oven-dry method, illustrative)', 'Report reference: DEMO-LAB-2026-003'],
  ];
  for (const [batchId, file, title, line, ref] of labDocs) {
    if (!db.prepare('SELECT 1 FROM batches WHERE id = ?').get(batchId)) continue;
    if (db.prepare('SELECT 1 FROM evidence WHERE batch_id = ? AND kind = ?').get(batchId, 'lab_report')) continue;
    await pdfFor(file, [title, line, ref, 'Tested on: ' + day(-4)]);
    db.prepare(`INSERT INTO evidence (id, batch_id, kind, label, filename, mime, stored_name, visibility, uploaded_by, note, created_at)
      VALUES (?, ?, 'lab_report', 'Laboratory result summary (DEMO)', ?, 'application/pdf', ?, 'public', 'U-INS', 'Demo document. Not a real laboratory certificate.', ?)`)
      .run(`EV-MK-${batchId.slice(3)}`, batchId, file, file, ts);
  }

  for (const [batchId, type, actor, payload] of ledger) appendEvent({ batch_id: batchId, event_type: type, actor, payload });
  syncProductImages();
  console.log(`Marketplace demo data ready: ${CATEGORIES.length} categories, ${NEW_PRODUCTS.length} new catalogue products, ${CENTRES.length} centres, ${BATCHES.length} new demo batches.`);
  return true;
}

// Sample buyer-side records so every dashboard tab has content in demo mode.
function seedBuyerActivity(ts) {
  const enq = (id, batch, buyer, kind, status, qty, unit, use, delivery, message, price, counter, orderId, ago) => {
    db.prepare(`INSERT OR IGNORE INTO enquiries (id, batch_id, buyer_user_id, message, kind, status, created_at, quantity, unit, intended_use, delivery_location, indicative_price, counter_price, order_id, is_demo, updated_at, responded_at, responded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`)
      .run(id, batch, buyer, message, kind, status, at(-ago), qty, unit, use, delivery, price, counter, orderId, at(-ago + 1), status === 'open' ? null : at(-ago + 1), status === 'open' ? null : 'U-CEN1');
  };
  const msg = (enquiry, role, kind, body, counter, ago) => db.prepare('INSERT OR IGNORE INTO enquiry_messages (id, enquiry_id, sender_id, sender_role, kind, body, counter_price, created_at) VALUES (?, ?, NULL, ?, ?, ?, ?, ?)')
    .run(`EM-MK-${enquiry}-${Math.random().toString(36).slice(2, 5)}`, enquiry, role, kind, body, counter, at(-ago, 11));
  const order = (id, enquiry, buyer, batch, qty, unit, price, status, delivery, ago) => db.prepare(`INSERT OR IGNORE INTO orders (id, offer_id, buyer_user_id, batch_id, quantity, unit, agreed_price, currency, price_unit, status, payment_status, delivery_status, is_demo, created_at, enquiry_id, updated_at)
    VALUES (?, NULL, ?, ?, ?, ?, ?, 'INR', ?, ?, 'not_recorded', ?, 1, ?, ?, ?)`).run(id, buyer, batch, qty, unit, price, unit, status, delivery, at(-ago), enquiry, at(-ago + 1));

  enq('EN-MK-1', 'BT-N01', 'U-BUY1', 'purchase_request', 'accepted', 100, 'kg', 'Value-added processing', 'Purulia town, collection from centre', 'Purchase request for 100 kg.', 145, null, 'OR-MK-1', 9);
  msg('EN-MK-1', 'buyer', 'message', 'Purchase request for 100 kg. Intended use: value-added processing.', null, 9);
  msg('EN-MK-1', 'centre', 'accept', 'Accepted at the listed indicative price. Order OR-MK-1 created.', 145, 8);
  order('OR-MK-1', 'EN-MK-1', 'U-BUY1', 'BT-N01', 100, 'kg', 145, 'dispatched', 'dispatched', 9);

  enq('EN-MK-2', 'BT-N05', 'U-BUY1', 'enquiry', 'negotiating', 10, 'kg', 'Retail packs', 'Kolkata', 'Is a lab report available and can the price be reduced for 10 kg?', 380, 360, null, 4);
  msg('EN-MK-2', 'buyer', 'message', 'Is a lab report available and can the price be reduced for 10 kg?', null, 4);
  msg('EN-MK-2', 'centre', 'counter', 'The demo laboratory summary is attached to the batch page. We can offer 360 per kg for 10 kg or more.', 360, 3);

  enq('EN-MK-3', 'BT-N03', 'U-BUY1', 'bulk_enquiry', 'open', 600, 'piece', 'Leaf plate manufacturing', 'Bankura town', 'Bulk enquiry for 600 pieces, fortnightly supply if quality holds.', 2.8, null, null, 1);
  msg('EN-MK-3', 'buyer', 'message', 'Bulk enquiry for 600 pieces, fortnightly supply if quality holds.', null, 1);

  enq('EN-MK-4', 'BT-N12', 'U-BUY1', 'purchase_request', 'rejected', 100, 'kg', 'Seed processing', 'Durgapur', 'Purchase request for 100 kg.', 24, null, null, 12);
  msg('EN-MK-4', 'buyer', 'message', 'Purchase request for 100 kg.', null, 12);
  msg('EN-MK-4', 'centre', 'reject', 'Sorry, this lot is reserved for an existing standing order.', null, 11);

  enq('EN-MK-5', 'BT-N07', 'U-BUY1', 'purchase_request', 'accepted', 40, 'kg', 'Craft use', 'Purulia centre pick-up', 'Purchase request for 40 kg.', 290, null, 'OR-MK-2', 15);
  msg('EN-MK-5', 'buyer', 'message', 'Purchase request for 40 kg.', null, 15);
  msg('EN-MK-5', 'centre', 'accept', 'Accepted. Order OR-MK-2 created.', 290, 14);
  order('OR-MK-2', 'EN-MK-5', 'U-BUY1', 'BT-N07', 40, 'kg', 290, 'delivered', 'delivered', 15);

  enq('EN-MK-6', 'BT-N15', 'U-BUY2', 'enquiry', 'open', 20, 'kg', 'Herbal unit trial', 'Jhargram', 'Can you share handling details for this batch?', 160, null, null, 2);
  msg('EN-MK-6', 'buyer', 'message', 'Can you share handling details for this batch?', null, 2);

  for (const [kind, ref] of [['product', 'AV-WB-MAH-0011'], ['product', 'AV-WB-HON-0015'], ['product', 'AV-WB-MED-0025'], ['centre', 'CE-PUR'], ['centre', 'CE-JHA']]) {
    db.prepare('INSERT OR IGNORE INTO buyer_saved (user_id, kind, ref_id, created_at) VALUES (\'U-BUY1\', ?, ?, ?)').run(kind, ref, ts);
  }
  [['product', 'AV-WB-SAL-0013', null, 1], ['product', 'AV-WB-LAC-0017', null, 2], ['product', 'AV-WB-SSD-0022', null, 3], ['product', 'AV-WB-HON-0015', null, 4],
    ['verify', 'AV-WB-MAH-0011', 'verified', 2], ['verify', 'AV-WB-TAM-0026', 'suspended', 5], ['verify', 'AV-WB-XXX-9999', 'not_found', 6], ['verify', 'AV-WB-HON-0004', 'verified_with_limitations', 8],
  ].forEach(([kind, ref, outcome, ago], i) => {
    db.prepare('INSERT OR IGNORE INTO buyer_viewed (id, user_id, kind, ref_id, outcome, viewed_at) VALUES (?, \'U-BUY1\', ?, ?, ?, ?)').run(`VW-MK-${i + 1}`, kind, ref, outcome, at(-ago, 12));
  });
  db.prepare(`INSERT OR IGNORE INTO notifications (id, user_id, kind, title, body, link, is_read, created_at) VALUES
    ('N-MK-1', 'U-BUY1', 'market_enquiry', 'Seller replied on AV-WB-HON-0015', 'Proposed ₹360 per kg for 10 kg or more.', '/market/account/enquiries', 0, ?),
    ('N-MK-2', 'U-BUY1', 'market_order', 'Order OR-MK-1 is dispatched', 'Mahua flowers (AV-WB-MAH-0011) status updated.', '/market/account/orders', 0, ?)`).run(at(-3), at(-1));
  // Seller-side notification so the Producer Portal bell shows the new enquiry too
  db.prepare(`INSERT OR IGNORE INTO notifications (id, user_id, kind, title, body, link, is_read, created_at) VALUES
    ('N-MK-3', 'U-CEN2', 'market_enquiry', 'New enquiry for AV-WB-HON-0015', 'Jangal Haat (demonstration buyer) asked about 10 kg. Open Marketplace Desk to respond.', '/marketplace', 0, ?)`).run(at(-1));
}

module.exports = { run };

if (require.main === module) {
  run({ force: process.argv.includes('--force') }).then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
}
