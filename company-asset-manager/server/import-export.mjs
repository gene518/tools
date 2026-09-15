import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import {
  AppError,
  assetSchema,
  validateAsset,
  createAsset,
  STATUS,
} from "./domain.mjs";
import { transaction } from "./database.mjs";
export const columns = {
  资产编号: "code",
  设备名称: "name",
  设备类型: "category",
  品牌: "brand",
  型号: "model",
  序列号: "serial",
  CPU: "cpu",
  内存: "memory",
  硬盘: "disk",
  来源: "source",
  入库日期: "entry_date",
  采购日期: "purchase_date",
  采购金额: "purchase_amount",
  保修到期日: "warranty_date",
  归属人工号: "owner_code",
  使用人工号: "user_code",
  状态: "status",
  位置: "location",
  设备状况: "condition",
  配件清单: "accessories",
  备注: "notes",
  领用日期: "usage_date",
};
const statusLookup = Object.fromEntries(
  Object.entries(STATUS).map(([k, v]) => [v, k]),
);
export function exportCsv(assets) {
  const rows = assets.map((asset) =>
    Object.fromEntries(
      Object.entries(columns).map(([label, key]) => {
        let value =
          key === "source"
            ? asset.source === "new"
              ? "新增入库"
              : "存量登记"
            : key === "status"
              ? STATUS[asset.status]
              : (asset[key] ?? "");
        if (typeof value === "string" && /^[=+\-@\t\r]/.test(value))
          value = "'" + value;
        return [label, value];
      }),
    ),
  );
  return stringify(rows, {
    header: true,
    columns: Object.keys(columns),
    bom: true,
  });
}
export async function importCsv(db, actor, csv, dryRun) {
  if (typeof csv !== "string" || !csv.trim())
    throw new AppError(422, "请选择非空 CSV 文件");
  let records;
  try {
    records = parse(csv, {
      bom: true,
      columns: (headers) => {
        if (new Set(headers).size !== headers.length)
          throw new Error("表头重复");
        const unknown = headers.filter((h) => !Object.hasOwn(columns, h));
        if (unknown.length)
          throw new Error(`无法识别表头：${unknown.join("、")}`);
        if (
          !headers.includes("设备名称") ||
          !headers.includes("归属人工号") ||
          !headers.includes("入库日期")
        )
          throw new Error("缺少设备名称、归属人工号或入库日期表头");
        return headers;
      },
      skip_empty_lines: true,
      trim: true,
      info: true,
      max_record_size: 30000,
    });
  } catch (error) {
    throw new AppError(422, `CSV 格式错误：${error.message}`);
  }
  if (!records.length || records.length > 500)
    throw new AppError(422, "每次可导入 1 到 500 条资产");
  const errors = [],
    inputs = [],
    codes = new Set(),
    serials = new Set();
  for (const { record, info } of records) {
    try {
      const raw = Object.fromEntries(
        Object.entries(record).map(([k, v]) => [columns[k], v]),
      );
      const owner = await db
        .prepare("SELECT id FROM employees WHERE code=?")
        .get(raw.owner_code || "");
      if (!owner)
        throw new Error(`归属人工号不存在：${raw.owner_code || "未填写"}`);
      const user = raw.user_code
        ? await db
            .prepare("SELECT id FROM employees WHERE code=?")
            .get(raw.user_code)
        : null;
      if (raw.user_code && !user)
        throw new Error(`使用人工号不存在：${raw.user_code}`);
      delete raw.owner_code;
      delete raw.user_code;
      raw.owner_id = owner.id;
      raw.user_id = user?.id || null;
      raw.source =
        {
          存量登记: "existing",
          新增入库: "new",
        }[raw.source] ||
        raw.source ||
        "existing";
      raw.status = statusLookup[raw.status] || raw.status || "available";
      raw.category ||= "笔记本电脑";
      raw.condition ||= "完好";
      const input = assetSchema.parse(raw);
      await validateAsset(db, input);
      if (input.code && codes.has(input.code.toLowerCase()))
        throw new Error("文件内资产编号重复");
      if (input.serial && serials.has(input.serial.toLowerCase()))
        throw new Error("文件内序列号重复");
      if (input.code) codes.add(input.code.toLowerCase());
      if (input.serial) serials.add(input.serial.toLowerCase());
      inputs.push(input);
    } catch (error) {
      errors.push({
        row: info.lines,
        error: error.issues
          ? error.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join("；")
          : error.message,
      });
    }
  }
  if (errors.length)
    throw new AppError(422, "导入校验失败，未写入任何资产", errors);
  if (dryRun)
    return {
      valid: true,
      count: inputs.length,
    };
  return await transaction(db, async () => {
    const assets = [];
    for (const input of inputs)
      assets.push(await createAsset(db, actor, input));
    return { count: inputs.length, assets };
  });
}
