import { execFileSync } from "node:child_process";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { resolve } from "node:path";
import { EVENT_CATEGORIES } from "../shared/event-categories.mjs";
const target = process.argv[2] || "local",
  stage = process.argv[3] || "login";
const env = parseEnv(
  readFileSync(
    ["cloud", "public", "domain"].includes(target)
      ? "deploy/production.local.env"
      : ".env",
    "utf8",
  ),
);
const session = `assets-${target}`;
const screenshotDir = resolve(`output/playwright/${target}`);
mkdirSync(screenshotDir, { recursive: true });
const stages = {
  navigationReadOnly: `await page.setViewportSize({width:1440,height:1000});await page.reload();
    const details=page.getByRole('button',{name:/^查看详情 /}).first();await details.waitFor();
    const label=await details.getAttribute('aria-label');const code=label.slice('查看详情 '.length);
    await details.click();await page.getByRole('dialog',{name:'资产详情',exact:true}).getByText(code,{exact:true}).waitFor();
    await page.screenshot({path:${JSON.stringify(screenshotDir + "/21-live-drawer.png")},fullPage:true});
    await page.getByRole('dialog').getByRole('button',{name:'关闭',exact:true}).click();
    await page.getByRole('button',{name:'交接与日志',exact:true}).click();
    if(await page.getByRole('tab',{name:/设备信息/}).getAttribute('aria-selected')!=='true')throw new Error('Device logs are not the default');
    if(await page.getByRole('combobox',{name:'筛选操作类型'}).count())throw new Error('Dropdown still present');
    const categories=${JSON.stringify(EVENT_CATEGORIES)};
    for(const category of categories){
      const loaded=page.waitForResponse(r=>r.url().endsWith('/api/events?page=1&category='+category.key)&&r.status()===200);
      if(category.key==='device')await page.getByRole('button',{name:'刷新数据'}).click();else await page.getByRole('tab',{name:new RegExp(category.label)}).click();
      await loaded;await page.waitForFunction(()=>document.querySelector('[role="tabpanel"]')?.getAttribute('aria-busy')==='false');
      const operations=await page.getByRole('tabpanel').locator('tbody tr td:first-child').allTextContents();
      const labels=${JSON.stringify({ create: "资产登记", edit: "信息修正", repair: "送修", restore: "维修完成", retire: "报废", attachment: "添加附件", assign: "设备分配", transfer: "设备转交", return: "设备归还", reserve: "发起交接", confirm: "确认交接", cancel: "取消交接", ownership: "归属变更", employee_create: "新增员工", employee_edit: "更新员工", account_create: "新增账号", account_edit: "更新账号", password: "修改密码", login: "登录", logout: "退出登录" })};
      if(!operations.every(label=>category.actions.map(key=>labels[key]).includes(label.trim())))throw new Error('Log category contents mismatch: '+category.key);
      await page.screenshot({path:${JSON.stringify(screenshotDir)}+'/22-live-'+category.key+'.png',fullPage:true});
    }
    await page.getByRole('tab',{name:/账号安全/}).press('Home');
    if(await page.getByRole('tab',{name:/设备信息/}).getAttribute('aria-selected')!=='true')throw new Error('Keyboard tab navigation failed');
    await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth);
    await page.getByRole('tab',{name:/领用交接/}).click();await page.screenshot({path:${JSON.stringify(screenshotDir + "/23-live-mobile-tabs.png")},fullPage:true});
    await page.getByRole('button',{name:/^资产台账/}).click();await details.waitFor();
    await page.screenshot({path:${JSON.stringify(screenshotDir + "/24-live-mobile-ledger.png")},fullPage:true});
    await details.click();await page.getByRole('dialog',{name:'资产详情',exact:true}).waitFor();await page.getByRole('dialog').getByRole('button',{name:'关闭',exact:true}).click();
    await page.setViewportSize({width:1440,height:1000});`,
  navigation: `await page.setViewportSize({width:1440,height:1000});await page.reload();
    await page.getByRole('row').filter({hasText:'UAT-PC001'}).waitFor();
    const detail=page.getByRole('button',{name:'查看详情 UAT-PC001',exact:true});
    if(!await detail.isVisible())throw new Error('Explicit detail button is missing');
    await detail.click();await page.getByRole('dialog',{name:'资产详情',exact:true}).waitFor();
    await page.getByRole('dialog').getByRole('heading',{name:'验收 ThinkPad T14',exact:true}).waitFor();
    await page.getByRole('dialog').getByRole('button',{name:'关闭',exact:true}).click();
    await page.screenshot({path:${JSON.stringify(screenshotDir + "/17-detail-button.png")},fullPage:true});
    await page.getByRole('button',{name:'交接与日志',exact:true}).click();
    await page.getByRole('tab',{name:/设备信息/}).waitFor();
    if(await page.getByRole('tab',{name:/设备信息/}).getAttribute('aria-selected')!=='true')throw new Error('Device logs are not selected by default');
    if(await page.getByRole('combobox',{name:'筛选操作类型'}).count())throw new Error('Old dropdown is still present');
    await page.getByRole('tabpanel').getByText('资产登记',{exact:true}).first().waitFor();
    await page.getByRole('tabpanel').getByText('信息修正',{exact:true}).first().waitFor();
    if(await page.getByRole('tabpanel').getByText('登录',{exact:true}).count())throw new Error('Account log leaked into device logs');
    await page.screenshot({path:${JSON.stringify(screenshotDir + "/18-device-logs.png")},fullPage:true});
    await page.getByRole('tab',{name:/领用交接/}).click();await page.getByRole('tabpanel').getByText('设备转交',{exact:true}).first().waitFor();
    await page.getByRole('tabpanel').getByText('归属变更',{exact:true}).first().waitFor();
    await page.getByRole('tab',{name:/人员变更/}).click();await page.getByRole('tabpanel').getByText('新增员工',{exact:true}).first().waitFor();
    await page.getByRole('tabpanel').getByRole('columnheader',{name:'员工',exact:true}).waitFor();
    await page.getByRole('tab',{name:/账号安全/}).click();await page.getByRole('tabpanel').getByText('登录',{exact:true}).first().waitFor();
    await page.getByRole('tab',{name:/账号安全/}).press('Home');
    if(await page.getByRole('tab',{name:/设备信息/}).getAttribute('aria-selected')!=='true')throw new Error('Tab keyboard navigation failed');
    await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth);
    await page.getByRole('tab',{name:/领用交接/}).click();await page.getByRole('tabpanel').getByText('设备转交',{exact:true}).first().waitFor();
    await page.screenshot({path:${JSON.stringify(screenshotDir + "/19-mobile-tabs.png")},fullPage:true});
    await page.getByRole('button',{name:/^资产台账/}).click();await page.getByRole('button',{name:'查看详情 UAT-PC001',exact:true}).click();
    await page.getByRole('dialog',{name:'资产详情',exact:true}).waitFor();await page.getByRole('dialog').getByRole('button',{name:'关闭',exact:true}).click();
    await page.screenshot({path:${JSON.stringify(screenshotDir + "/20-mobile-details.png")},fullPage:true});await page.setViewportSize({width:1440,height:1000});`,
  advanced: `await page.getByRole('button',{name:'登记资产',exact:true}).first().click();
    let dialog=page.getByRole('dialog');
    await dialog.getByRole('textbox',{name:'名称'}).fill('验收重复序列号');
    await dialog.getByRole('textbox',{name:'序列号',exact:true}).fill('UAT-SN001');
    await dialog.getByRole('combobox',{name:'资产归属人'}).selectOption({label:'验收归属人 · UAT-E001 · 验收信息部'});
    await dialog.getByRole('button',{name:'保存资产',exact:true}).click();await dialog.getByText('设备序列号已存在').waitFor();
    await dialog.getByRole('button',{name:'取消',exact:true}).click();
    await page.getByRole('combobox',{name:'归属人',exact:true}).selectOption({label:'验收使用人甲 · UAT-E002 · 验收产品部'});
    await page.getByText('1 条资产',{exact:true}).waitFor();
    if(!await page.getByRole('row').filter({hasText:'UAT-PC001'}).count())throw new Error('Owner filter failed');
    await page.getByRole('combobox',{name:'使用人',exact:true}).selectOption({label:'验收使用人甲 · UAT-E002 · 验收产品部'});
    await page.getByText('没有符合条件的资产').waitFor();
    await page.getByRole('combobox',{name:'归属人',exact:true}).selectOption('');await page.getByText('2 条资产',{exact:true}).waitFor();
    await page.getByRole('button',{name:'清除筛选',exact:true}).click();
    await page.getByRole('button',{name:'查看详情 UAT-IMP002',exact:true}).click();
    await page.getByRole('dialog').getByRole('button',{name:'报废',exact:true}).click();
    await page.getByRole('textbox',{name:'报废原因'}).fill('验收：设备达到报废条件');
    await page.getByRole('button',{name:'确认报废',exact:true}).click();await page.getByRole('heading',{name:'报废',exact:true}).waitFor({state:'hidden'});
    await page.getByRole('dialog').getByText('已报废',{exact:true}).waitFor();
    if(await page.getByRole('dialog').getByRole('button',{name:'分配',exact:true}).count())throw new Error('Retired asset is assignable');
    await page.getByRole('dialog').getByRole('button',{name:'关闭',exact:true}).click();
    await page.getByRole('button',{name:'员工与部门',exact:true}).click();
    await page.getByRole('button',{name:'编辑员工 验收使用人甲',exact:true}).click();
    await page.getByRole('combobox',{name:'任职状态'}).selectOption('departed');
    await page.getByRole('button',{name:'保存员工'}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
    await page.getByRole('button',{name:/^资产台账/}).click();await page.getByRole('button').filter({hasText:'2 台设备仍由离职员工使用'}).click();
    await page.getByText('2 条资产',{exact:true}).waitFor();
    await page.screenshot({path:${JSON.stringify(screenshotDir + "/09-departed-users.png")},fullPage:true});
    await page.getByRole('button',{name:'员工与部门',exact:true}).click();await page.getByRole('button',{name:'编辑员工 验收使用人甲',exact:true}).click();
    await page.getByRole('combobox',{name:'任职状态'}).selectOption('active');await page.getByRole('button',{name:'保存员工'}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
    await page.getByRole('button',{name:'交接与日志',exact:true}).click();await page.getByRole('tab',{name:/领用交接/}).click();
    await page.getByRole('row').filter({hasText:'UAT-PC001'}).waitFor();
    await page.getByRole('button',{name:'统计概览',exact:true}).click();await page.getByText('¥13,999.98',{exact:true}).waitFor();
    await page.screenshot({path:${JSON.stringify(screenshotDir + "/10-overview.png")},fullPage:true});
    await page.getByRole('button',{name:/^资产台账/}).click();if(await page.getByRole('button',{name:'清除筛选',exact:true}).count())await page.getByRole('button',{name:'清除筛选',exact:true}).click();`,
  mobile: `await page.setViewportSize({width:390,height:844});
    await page.getByRole('row').filter({hasText:'UAT-PC001'}).waitFor();
    await page.waitForFunction(()=>document.documentElement.scrollWidth<=window.innerWidth);
    await page.screenshot({path:${JSON.stringify(screenshotDir + "/11-mobile-ledger.png")},fullPage:true});
    await page.getByRole('button',{name:'查看详情 UAT-PC001',exact:true}).click();
    await page.getByRole('dialog').getByRole('button',{name:'编辑资产',exact:true}).click();
    const form=page.getByRole('dialog').last();await form.getByRole('textbox',{name:'位置',exact:true}).fill('验收移动端编辑 B-08');
    await form.getByRole('button',{name:'保存资产',exact:true}).click();await page.getByRole('heading',{name:'编辑资产档案',exact:true}).waitFor({state:'hidden'});
    await page.getByRole('dialog').getByText('验收移动端编辑 B-08',{exact:true}).waitFor();
    await page.screenshot({path:${JSON.stringify(screenshotDir + "/12-mobile-detail.png")},fullPage:true});
    await page.getByRole('dialog').getByRole('button',{name:'关闭',exact:true}).click();
    await page.setViewportSize({width:320,height:740});
    await page.waitForFunction(()=>document.documentElement.scrollWidth<=window.innerWidth);
    await page.screenshot({path:${JSON.stringify(screenshotDir + "/13-small-mobile.png")},fullPage:true});
    await page.setViewportSize({width:1440,height:1000});await page.reload();await page.getByRole('row').filter({hasText:'UAT-PC001'}).waitFor();
    if(!(await page.getByRole('row').filter({hasText:'UAT-PC001'}).innerText()).includes('验收移动端编辑 B-08'))throw new Error('Edited location did not persist');
    await page.screenshot({path:${JSON.stringify(screenshotDir + "/14-final-desktop.png")},fullPage:true});`,
  accounts: `if(!await page.getByRole('dialog').count()){await page.getByRole('button',{name:'账号权限',exact:true}).click();await page.getByRole('button',{name:'新增账号',exact:true}).click();}
    const dialog=page.getByRole('dialog');
    await dialog.getByRole('textbox',{name:'登录账号'}).fill('uat-viewer');
    await dialog.getByRole('textbox',{name:'显示名称'}).fill('验收只读账号');
    await dialog.getByRole('textbox',{name:'初始密码'}).fill(${JSON.stringify(env.ADMIN_PASSWORD + "-Viewer")});
    await dialog.getByRole('button',{name:'保存',exact:true}).click();await dialog.waitFor({state:'hidden'});
    await page.getByRole('row').filter({hasText:'uat-viewer'}).waitFor();
    await page.getByRole('button',{name:'退出登录',exact:true}).click();await page.getByRole('heading',{name:'登录资产工作台'}).waitFor();
    const login=async(username,password)=>{await page.getByRole('textbox',{name:'账号'}).fill(username);await page.getByRole('textbox',{name:'密码'}).fill(password);await page.getByRole('button',{name:'登录',exact:true}).click();await page.getByRole('heading',{name:'资产台账',exact:true}).waitFor();};
    await login('uat-viewer',${JSON.stringify(env.ADMIN_PASSWORD + "-Viewer")});
    await page.getByRole('row').filter({hasText:'UAT-PC001'}).waitFor();
    for(const name of ['登记资产','导入','账号权限'])if(await page.getByRole('button',{name,exact:true}).count())throw new Error('Viewer has privileged control: '+name);
    await page.getByRole('button',{name:'查看详情 UAT-PC001',exact:true}).click();
    for(const name of ['转交','归还','变更归属','编辑资产'])if(await page.getByRole('dialog').getByRole('button',{name,exact:true}).count())throw new Error('Viewer can mutate asset');
    await page.screenshot({path:${JSON.stringify(screenshotDir + "/08-viewer.png")},fullPage:true});
    await page.getByRole('dialog').getByRole('button',{name:'关闭',exact:true}).click();
    await page.getByRole('button',{name:'修改密码',exact:true}).click();
    await page.getByRole('textbox',{name:'当前密码'}).fill(${JSON.stringify(env.ADMIN_PASSWORD + "-Viewer")});
    await page.getByRole('textbox',{name:'新密码'}).fill(${JSON.stringify(env.ADMIN_PASSWORD + "-Changed")});
    await page.getByRole('dialog').getByRole('button',{name:'保存',exact:true}).click();
    await page.getByRole('heading',{name:'登录资产工作台'}).waitFor();
    await login('uat-viewer',${JSON.stringify(env.ADMIN_PASSWORD + "-Changed")});
    await page.getByRole('button',{name:'退出登录',exact:true}).click();await page.getByRole('heading',{name:'登录资产工作台'}).waitFor();
    await login(${JSON.stringify(env.ADMIN_USERNAME)},${JSON.stringify(env.ADMIN_PASSWORD)});`,
  importAttachments: `await page.getByRole('button',{name:'导入',exact:true}).click();
    let dialog=page.getByRole('dialog');
    const templatePromise=page.waitForEvent('download');await dialog.getByRole('link',{name:'下载 CSV 模板'}).click();
    await (await templatePromise).saveAs(${JSON.stringify(screenshotDir + "/import-template.csv")});
    await dialog.getByLabel('资产 CSV 文件').setInputFiles(${JSON.stringify(resolve("tests/fixtures/import-invalid.csv"))});
    await dialog.getByRole('button',{name:'校验文件'}).click();
    await dialog.getByText('导入校验失败，未写入任何资产',{exact:false}).waitFor();
    if(!await dialog.getByRole('button',{name:'确认导入'}).isDisabled())throw new Error('Invalid file is importable');
    await page.screenshot({path:${JSON.stringify(screenshotDir + "/06-import-validation.png")},fullPage:true});
    await dialog.getByLabel('资产 CSV 文件').setInputFiles(${JSON.stringify(resolve("tests/fixtures/import-valid.csv"))});
    await dialog.getByRole('button',{name:'校验文件'}).click();await dialog.getByText('校验通过，待导入 2 条资产').waitFor();
    await dialog.getByRole('button',{name:'确认导入'}).click();await dialog.waitFor({state:'hidden'});
    await page.getByRole('row').filter({hasText:'UAT-IMP001'}).waitFor();
    if(await page.getByRole('row').filter({hasText:'UAT-BAD001'}).count())throw new Error('Partial import occurred');
    const downloadPromise=page.waitForEvent('download');await page.getByRole('link',{name:'导出',exact:true}).click();
    await (await downloadPromise).saveAs(${JSON.stringify(screenshotDir + "/exported-assets.csv")});
    await page.getByRole('button',{name:'查看详情 UAT-PC001',exact:true}).click();
    dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:/^附件/}).click();
    await dialog.getByLabel('上传附件').setInputFiles(${JSON.stringify(screenshotDir + "/03-ledger-populated.png")});
    const link=dialog.getByRole('link').filter({hasText:'03-ledger-populated.png'});await link.waitFor();
    const attachmentPromise=page.waitForEvent('download');await link.click();
    await (await attachmentPromise).saveAs(${JSON.stringify(screenshotDir + "/attachment-downloaded.png")});
    await page.screenshot({path:${JSON.stringify(screenshotDir + "/07-attachment.png")},fullPage:true});
    await dialog.getByRole('button',{name:'关闭',exact:true}).click();`,
  handovers: `const assertText=async(text)=>{await page.getByRole('dialog').first().getByText(text,{exact:true}).first().waitFor();};
    const submit=async(button,heading)=>{await page.getByRole('dialog').last().getByRole('button',{name:button,exact:true}).click();await page.getByRole('heading',{name:heading,exact:true}).waitFor({state:'hidden'});};
    const choose=async(name)=>{await page.getByRole('dialog').last().getByRole('combobox',{name:'接收使用人'}).selectOption({label:name});};
    const open=async(name)=>{await page.getByRole('dialog').first().getByRole('button',{name,exact:true}).click();};
    await choose('验收使用人甲 · UAT-E002 · 验收产品部');
    await page.getByRole('checkbox',{name:'等待交接确认'}).check();
    await submit('确认设备分配','设备分配');await assertText('待交接');
    if(await page.getByRole('dialog').getByRole('button',{name:'分配',exact:true}).count())throw new Error('Pending asset still assignable');
    await open('取消交接');await submit('确认取消交接','取消交接');await assertText('待分配');
    await open('分配');await choose('验收使用人甲 · UAT-E002 · 验收产品部');
    await page.getByRole('checkbox',{name:'等待交接确认'}).check();await submit('确认设备分配','设备分配');
    await open('确认交接');await submit('确认交接','确认交接');await assertText('使用中');await assertText('验收归属人');await assertText('验收使用人甲');
    await open('转交');await choose('验收使用人乙 · UAT-E003 · 验收研发部');await submit('确认设备转交','设备转交');
    await assertText('验收归属人');await assertText('验收使用人乙');
    await page.screenshot({path:${JSON.stringify(screenshotDir + "/04-transfer.png")},fullPage:true});
    await open('变更归属');await page.getByRole('dialog').last().getByRole('combobox',{name:'新归属人'}).selectOption({label:'验收使用人甲 · UAT-E002 · 验收产品部'});
    await page.getByRole('textbox',{name:'归属变更原因'}).fill('验收：责任部门变更，使用人保持不变');await submit('确认归属变更','归属变更');
    await assertText('验收使用人甲');await assertText('验收使用人乙');
    await open('归还');await page.getByRole('checkbox',{name:'归还后送修'}).check();await submit('确认设备归还','设备归还');await assertText('维修中');await assertText('未分配');
    await open('维修完成');await submit('确认维修完成','维修完成');await assertText('待分配');
    await open('分配');await choose('验收使用人乙 · UAT-E003 · 验收研发部');await submit('确认设备分配','设备分配');await assertText('使用中');
    await page.getByRole('dialog').getByRole('button',{name:/^流转记录/}).click();
    for(const label of ['归属变更','设备转交','设备归还','取消交接','确认交接','维修完成'])await page.getByRole('dialog').getByText(label,{exact:true}).first().waitFor();
    await page.screenshot({path:${JSON.stringify(screenshotDir + "/05-history.png")},fullPage:true});
    await page.getByRole('dialog').getByRole('button',{name:'关闭',exact:true}).click();
    const row=page.getByRole('row').filter({hasText:'UAT-PC001'});const text=await row.innerText();
    if(!text.includes('验收使用人甲')||!text.includes('验收使用人乙'))throw new Error('Ledger relationships are incorrect');`,
  assets: `if(!await page.getByRole('dialog').count())await page.getByRole('button',{name:'登记资产',exact:true}).first().click();
    let dialog=page.getByRole('dialog');
    await dialog.getByRole('textbox',{name:'资产编号',exact:true}).fill('UAT-PC001');
    await dialog.getByRole('textbox',{name:'名称'}).fill('验收 ThinkPad T14');
    await dialog.getByRole('textbox',{name:'品牌',exact:true}).fill('Lenovo');
    await dialog.getByRole('textbox',{name:'型号',exact:true}).fill('ThinkPad T14 Gen 5');
    await dialog.getByRole('textbox',{name:'序列号',exact:true}).fill('UAT-SN001');
    await dialog.getByRole('textbox',{name:'内存',exact:true}).fill('32 GB');
    await dialog.getByRole('textbox',{name:'硬盘',exact:true}).fill('1 TB SSD');
    await dialog.getByRole('textbox',{name:'位置',exact:true}).fill('验收办公室 A-01');
    await dialog.getByRole('combobox',{name:'资产归属人'}).selectOption({label:'验收归属人 · UAT-E001 · 验收信息部'});
    await dialog.getByRole('spinbutton',{name:'采购金额'}).fill('8999.99');
    await dialog.getByRole('textbox',{name:'配件清单'}).fill('电源适配器、电脑包');
    await dialog.getByRole('button',{name:'保存资产',exact:true}).click();
    await dialog.waitFor({state:'hidden'});
    await page.getByRole('row').filter({hasText:'UAT-PC001'}).waitFor();
    await page.reload();
    await page.getByRole('row').filter({hasText:'UAT-PC001'}).waitFor();
    await page.getByRole('button',{name:'登记资产',exact:true}).first().click();
    dialog=page.getByRole('dialog');
    await dialog.getByRole('textbox',{name:'资产编号',exact:true}).fill('UAT-PC002');
    await dialog.getByRole('textbox',{name:'名称'}).fill('验收 MacBook Air 存量');
    await dialog.getByRole('combobox',{name:'登记来源'}).selectOption('existing');
    await dialog.getByRole('combobox',{name:'资产归属人'}).selectOption({label:'验收归属人 · UAT-E001 · 验收信息部'});
    await dialog.getByRole('combobox',{name:'资产状态'}).selectOption('in_use');
    await dialog.getByRole('combobox',{name:'当前使用人'}).selectOption({label:'验收使用人甲 · UAT-E002 · 验收产品部'});
    await dialog.getByRole('button',{name:'保存资产',exact:true}).click();
    await dialog.waitFor({state:'hidden'});
    const row=page.getByRole('row').filter({hasText:'UAT-PC002'});await row.waitFor();
    if(!(await row.innerText()).includes('验收使用人甲')||!(await row.innerText()).includes('验收归属人'))throw new Error('Owner and user missing');
    await page.screenshot({path:${JSON.stringify(screenshotDir + "/03-ledger-populated.png")},fullPage:true});
    await page.getByRole('button',{name:'查看详情 UAT-PC001',exact:true}).click();
    await page.getByRole('dialog').getByRole('button',{name:'分配',exact:true}).click();`,
  employees: `if(await page.getByRole('dialog').count())await page.getByRole('dialog').getByRole('button',{name:'取消',exact:true}).click();
    await page.getByRole('button',{name:'员工与部门',exact:true}).click();
    for (const employee of [{code:'UAT-E001',name:'验收归属人',department:'验收信息部'},{code:'UAT-E002',name:'验收使用人甲',department:'验收产品部'},{code:'UAT-E003',name:'验收使用人乙',department:'验收研发部'}]) {
      await page.getByRole('button',{name:'新增员工',exact:true}).click();
      const dialog=page.getByRole('dialog');
      await dialog.getByRole('textbox',{name:'工号'}).fill(employee.code);
      await dialog.getByRole('textbox',{name:'姓名'}).fill(employee.name);
      await dialog.getByRole('textbox',{name:'部门'}).fill(employee.department);
      await dialog.getByRole('button',{name:'保存员工',exact:true}).click();
      await dialog.waitFor({state:'hidden'});
      await page.getByRole('cell',{name:employee.department,exact:true}).waitFor();
    }
    await page.screenshot({path:${JSON.stringify(screenshotDir + "/02-employees.png")},fullPage:true});
    await page.getByRole('button',{name:/^资产台账/}).click();
    await page.getByRole('button',{name:'登记资产',exact:true}).first().click();`,
  login: `await page.getByRole('textbox',{name:'账号',exact:false}).fill(${JSON.stringify(env.ADMIN_USERNAME)});
    await page.getByRole('textbox',{name:'密码',exact:false}).fill(${JSON.stringify(env.ADMIN_PASSWORD)});
    await page.getByRole('button',{name:'登录',exact:true}).click();
    await page.getByRole('heading',{name:'资产台账',exact:true}).waitFor();
    await page.screenshot({path:${JSON.stringify(screenshotDir + "/01-ledger.png")},fullPage:true});`,
};
if (!stages[stage]) throw new Error(`Unknown stage: ${stage}`);
try {
  const result = execFileSync(
    "playwright-cli",
    [
      `-s=${session}`,
      "run-code",
      `async page => { ${stages[stage]} return ${JSON.stringify(stage + " passed")}; }`,
    ],
    { encoding: "utf8", timeout: 120000, maxBuffer: 5 * 1024 * 1024 },
  );
  const sanitized = result.replaceAll(env.ADMIN_PASSWORD, "[REDACTED]");
  writeFileSync(`${screenshotDir}/${stage}.log`, sanitized);
  if (!result.includes(`### Result\n"${stage} passed"`))
    throw new Error("Browser check did not report success");
  writeFileSync(
    `${screenshotDir}/${stage}.json`,
    JSON.stringify(
      { target, stage, passed: true, completedAt: new Date().toISOString() },
      null,
      2,
    ),
  );
  console.log(`${target}: ${stage} passed`);
} catch (error) {
  console.error(
    String(error.stdout || "").replaceAll(env.ADMIN_PASSWORD, "[REDACTED]"),
  );
  console.error(
    String(error.stderr || "").replaceAll(env.ADMIN_PASSWORD, "[REDACTED]"),
  );
  process.exit(1);
}
