const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync('客服記錄系統.classification-v31.js', 'utf8') + '\nthis.dictionary = {V3_PROJECT_PRODUCTS,V3_CLASSIFICATIONS,v3Active,v3Match};', context);
const {V3_PROJECT_PRODUCTS, V3_CLASSIFICATIONS, v3Active, v3Match} = context.dictionary;
vm.runInContext(fs.readFileSync('客服記錄系統.classification.js', 'utf8') + '\nthis.validate = validateV2Classification;', context);
for (const [project, product] of [['SWIFT','AI地磅查核系統'], ['榮福','廢棄物管理系統']]) {
  assert.ok(V3_PROJECT_PRODUCTS[project]?.includes(product), `${project} must expose its product`);
  for (const nature of ['故障/異常','資料/設定異動','帳務/文件','查詢/協助','其他/待確認']) {
    const choices = v3Active(product, nature, project);
    assert.ok(choices.length, `${project}/${nature} must offer a savable choice`);
    for (const choice of choices) {
      context.validate({project_name:project,new_product:product,case_nature:nature,new_category:choice.category,new_subcategory:choice.subcategory,classification_code:choice.code,classification_version:'v3_1_2026-10',classification_note:'待確認資訊'});
      assert.equal(v3Match({project_name:project,new_product:product,case_nature:nature,new_category:choice.category,new_subcategory:choice.subcategory})?.code, choice.code);
      assert.equal(v3Match({project_name:project==='SWIFT'?'榮福':'SWIFT',new_product:product,case_nature:nature,new_category:choice.category,new_subcategory:choice.subcategory}), undefined, 'project boundaries must remain strict');
      assert.throws(()=>context.validate({project_name:project,new_product:product,case_nature:nature,new_category:choice.category,new_subcategory:choice.subcategory,classification_code:'V3-0006',classification_version:'v3_1_2026-10'}), /分類代碼必須一致/);
    }
  }
}
assert.equal(new Set(V3_CLASSIFICATIONS.map(x=>x.code)).size, V3_CLASSIFICATIONS.length, 'codes must be unique');
assert.equal(v3Match({project_name:'FMS',new_product:'GPS',case_nature:'故障/異常',new_category:'GPS定位/軌跡',new_subcategory:'GPS定位未更新'}).code, 'V3-0006');
assert.equal(v3Match({project_name:'利澤焚化爐',new_product:'AI輔助垃圾檢查系統',case_nature:'查詢/協助',new_category:'利澤－處理進度',new_subcategory:'辨識改善進度查詢'}).code, 'V3-0244');
console.log('Project classifications: products, selectable tuples, unique codes, isolation and existing mappings passed.');
