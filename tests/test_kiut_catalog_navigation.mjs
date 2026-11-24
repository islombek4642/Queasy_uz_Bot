// tests/test_kiut_catalog_navigation.mjs
// Verifies KIUT root keyboard mapping and category navigation integrity
import assert from 'node:assert';
import {
  getKiutRootKeyboard,
  getKiutCategoryView,
  loadKiutTree,
} from '../tgcloud/lib/services/kiut_catalog_service.js';

async function testKiutCatalogNavigation() {
  console.log('🧪 Starting test_kiut_catalog_navigation...');

  const tree = await loadKiutTree();
  assert(tree, 'KIUT tree should be loaded');

  // Verify DB mapping exists for top-level categories
  const kunduzgiId = tree.categoriesByPath.get("KUNDUZGI TA'LIM");
  const sirtqiId = tree.categoriesByPath.get("SIRTQI TA'LIM");
  const kechkiId = tree.categoriesByPath.get("KECHKI TA'LIM");
  const masofaviyId = tree.categoriesByPath.get("MASOFAVIY TA'LIM");
  const tibbiyotId = tree.categoriesByPath.get("KUNDUZGI TA'LIM (TIBBIYOT)");
  const fanlarFarqiId = tree.categoriesByPath.get("FANLAR FARQI");

  assert(kunduzgiId, 'KUNDUZGI TA\'LIM should have an ID');
  assert(sirtqiId, 'SIRTQI TA\'LIM should have an ID');
  assert(kechkiId, 'KECHKI TA\'LIM should have an ID');
  assert(masofaviyId, 'MASOFAVIY TA\'LIM should have an ID');
  assert(tibbiyotId, 'KUNDUZGI TA\'LIM (TIBBIYOT) should have an ID');
  assert(fanlarFarqiId, 'FANLAR FARQI should have an ID');

  console.log('  ✅ Category IDs from DB:');
  console.log(`     Kunduzgi: ${kunduzgiId}`);
  console.log(`     Tibbiyot: ${tibbiyotId}`);
  console.log(`     Sirtqi: ${sirtqiId}`);
  console.log(`     Kechki: ${kechkiId}`);
  console.log(`     Masofaviy: ${masofaviyId}`);
  console.log(`     Fanlar farqi: ${fanlarFarqiId}`);

  // Fetch root keyboard
  const keyboard = await getKiutRootKeyboard();
  assert(Array.isArray(keyboard), 'Root keyboard should be an array of rows');

  // Find buttons by text
  const flatButtons = keyboard.flat();
  const btnKunduzgi = flatButtons.find((b) => b.text.includes("Kunduzgi"));
  const btnSirtqi = flatButtons.find((b) => b.text.includes("Sirtqi"));
  const btnKechki = flatButtons.find((b) => b.text.includes("Kechki"));
  const btnMasofaviy = flatButtons.find((b) => b.text.includes("Masofaviy"));
  const btnTibbiyot = flatButtons.find((b) => b.text.includes("Tibbiyot"));
  const btnFanlarFarqi = flatButtons.find((b) => b.text.includes("Fanlar farqi"));

  assert(btnKunduzgi && btnKunduzgi.callback_data === `kiut_c:${kunduzgiId}`, 'Kunduzgi button must map to Kunduzgi ID');
  assert(btnSirtqi && btnSirtqi.callback_data === `kiut_c:${sirtqiId}`, `Sirtqi button must map to Sirtqi ID (${sirtqiId}), got: ${btnSirtqi?.callback_data}`);
  assert(btnKechki && btnKechki.callback_data === `kiut_c:${kechkiId}`, 'Kechki button must map to Kechki ID');
  assert(btnMasofaviy && btnMasofaviy.callback_data === `kiut_c:${masofaviyId}`, 'Masofaviy button must map to Masofaviy ID');
  assert(btnTibbiyot && btnTibbiyot.callback_data === `kiut_c:${tibbiyotId}`, `Tibbiyot button must map to Tibbiyot ID (${tibbiyotId}), got: ${btnTibbiyot?.callback_data}`);
  assert(btnFanlarFarqi && btnFanlarFarqi.callback_data === `kiut_c:${fanlarFarqiId}`, `Fanlar farqi button must map to Fanlar farqi ID (${fanlarFarqiId}), got: ${btnFanlarFarqi?.callback_data}`);

  console.log('  ✅ Root keyboard callback_data correctly aligned with database IDs');

  // Verify that navigating to Sirtqi ID actually yields "SIRTQI TA'LIM"
  const sirtqiView = await getKiutCategoryView(sirtqiId);
  assert.strictEqual(sirtqiView.catPath, "SIRTQI TA'LIM", `Expected SIRTQI TA'LIM, got: ${sirtqiView?.catPath}`);
  assert(sirtqiView.subList.length > 0, 'Sirtqi should have subcategories');

  // Verify that navigating to Tibbiyot ID actually yields "KUNDUZGI TA'LIM (TIBBIYOT)"
  const tibbiyotView = await getKiutCategoryView(tibbiyotId);
  assert.strictEqual(tibbiyotView.catPath, "KUNDUZGI TA'LIM (TIBBIYOT)", `Expected KUNDUZGI TA'LIM (TIBBIYOT), got: ${tibbiyotView?.catPath}`);
  assert(tibbiyotView.subList.length > 0, 'Tibbiyot should have subcategories');

  // Verify that navigating to Fanlar Farqi ID actually yields "FANLAR FARQI"
  const ffView = await getKiutCategoryView(fanlarFarqiId);
  assert.strictEqual(ffView.catPath, "FANLAR FARQI", `Expected FANLAR FARQI, got: ${ffView?.catPath}`);

  console.log('  ✅ Category views verified: Sirtqi, Tibbiyot, Fanlar farqi correctly resolve their paths and subcategories');
  console.log('🎉 test_kiut_catalog_navigation passed successfully!');
}

testKiutCatalogNavigation().catch((err) => {
  console.error('❌ test_kiut_catalog_navigation failed:', err);
  process.exit(1);
});

