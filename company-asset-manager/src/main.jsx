import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  LayoutDashboard,
  Monitor,
  Laptop,
  Users,
  ClipboardList,
  ShieldCheck,
  Plus,
  Search,
  Download,
  Upload,
  X,
  ArrowRight,
  ArrowLeftRight,
  Undo2,
  Wrench,
  Check,
  CheckCircle2,
  Ban,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Pencil,
  KeyRound,
  Package,
  AlertCircle,
  Paperclip,
  RefreshCw,
  UserRound,
  Building2,
  MoreHorizontal,
  History,
  PanelRightOpen,
} from "lucide-react";
import { api, API } from "./api";
import { EVENT_CATEGORIES } from "../shared/event-categories.mjs";
import "./style.css";

const STATUS = {
  available: "待分配",
  pending: "待交接",
  in_use: "使用中",
  repair: "维修中",
  retired: "已报废",
};
const ACTION = {
  create: "资产登记",
  edit: "信息修正",
  assign: "设备分配",
  transfer: "设备转交",
  return: "设备归还",
  reserve: "发起交接",
  confirm: "确认交接",
  cancel: "取消交接",
  ownership: "归属变更",
  repair: "送修",
  restore: "维修完成",
  retire: "报废",
  attachment: "添加附件",
  employee_create: "新增员工",
  employee_edit: "更新员工",
  account_create: "新增账号",
  account_edit: "更新账号",
  password: "修改密码",
  login: "登录",
  logout: "退出登录",
};
const CATEGORIES = ["笔记本电脑", "台式电脑", "显示器", "打印机", "其他设备"];
const today = () =>
  new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" });
const money = (value) =>
  value == null
    ? "-"
    : new Intl.NumberFormat("zh-CN", {
        style: "currency",
        currency: "CNY",
        maximumFractionDigits: 2,
      }).format(value);
const time = (value) =>
  value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "-";
const initialFilters = {
  q: "",
  status: "",
  department: "",
  owner_id: "",
  user_id: "",
  departed: "",
};
const names = {
  code: "资产编号",
  name: "名称",
  category: "设备类型",
  brand: "品牌",
  model: "型号",
  serial: "序列号",
  cpu: "CPU",
  memory: "内存",
  disk: "硬盘",
  source: "来源",
  entry_date: "入库日期",
  purchase_date: "采购日期",
  purchase_amount: "采购金额",
  warranty_date: "保修到期日",
  owner_name: "归属人",
  owner_code: "归属人工号",
  owner_department: "归属部门",
  user_name: "使用人",
  user_code: "使用人工号",
  user_department: "使用部门",
  status: "状态",
  location: "位置",
  condition: "设备状况",
  accessories: "配件清单",
  notes: "备注",
  usage_date: "领用日期",
  department: "部门",
  role: "角色",
  active: "账号启用",
  username: "账号",
};
function display(key, value) {
  if (value === null || value === undefined || value === "") return "未登记";
  if (key === "status")
    return (
      STATUS[value] || { active: "在职", departed: "已离职" }[value] || value
    );
  if (key === "source") return value === "new" ? "新增入库" : "存量登记";
  if (key === "purchase_amount") return money(value);
  if (key === "role") return value === "admin" ? "管理员" : "只读";
  if (key === "active") return value ? "启用" : "停用";
  return String(value);
}
function IconButton({ icon: Icon, label, ...props }) {
  return (
    <button
      type="button"
      className="icon-button"
      title={label}
      aria-label={label}
      {...props}
    >
      <Icon size={17} />
    </button>
  );
}
function Badge({ status }) {
  return (
    <span className={`badge ${status}`}>
      <i />
      {STATUS[status] || status}
    </span>
  );
}
function Field({ label, children, ...props }) {
  return (
    <label className="field">
      <span>
        {label}
        {props.required && <b className="required"> *</b>}
      </span>
      {children || <input {...props} />}
    </label>
  );
}
function PersonSelect({
  label,
  employees,
  value,
  onChange,
  required = false,
  activeOnly = false,
  empty = "全部人员",
}) {
  return (
    <Field label={label} required={required}>
      <select
        required={required}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{required ? "请选择" : empty}</option>
        {employees
          .filter(
            (e) =>
              !activeOnly ||
              e.status === "active" ||
              String(e.id) === String(value),
          )
          .map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} · {e.code} · {e.department}
              {e.status === "departed" ? "（已离职）" : ""}
            </option>
          ))}
      </select>
    </Field>
  );
}
function ErrorMessage({ error }) {
  return error ? (
    <div className="form-error" role="alert">
      <AlertCircle size={17} />
      <div>
        {error.message}
        {error.details?.map((d, i) => (
          <div key={i}>
            {d.row ? `第 ${d.row} 行` : names[d.field] || d.field}：{d.error}
          </div>
        ))}
      </div>
    </div>
  ) : null;
}
function Modal({ title, children, onClose, wide = false, drawer = false }) {
  const ref = useRef(null);
  const titleId = React.useId();
  useEffect(() => {
    const node = ref.current;
    node.showModal();
    return () => node.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={`${wide ? "wide" : ""} ${drawer ? "drawer" : ""}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="dialog-inner">
        <div className="dialog-head">
          <h2 id={titleId}>{title}</h2>
          <IconButton icon={X} label="关闭" onClick={onClose} />
        </div>
        {children}
      </div>
    </dialog>
  );
}
function Empty({ text = "暂无记录", icon: Icon = Package, children }) {
  return (
    <div className="empty">
      <Icon size={32} />
      <strong>{text}</strong>
      {children}
    </div>
  );
}
function Pager({ page, total, pageSize, onChange }) {
  return (
    <div className="pager">
      <span>共 {total} 条</span>
      <div>
        <IconButton
          icon={ChevronLeft}
          label="上一页"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        />
        <span>
          {page} / {Math.max(1, Math.ceil(total / pageSize))}
        </span>
        <IconButton
          icon={ChevronRight}
          label="下一页"
          disabled={page * pageSize >= total}
          onClick={() => onChange(page + 1)}
        />
      </div>
    </div>
  );
}

function Login({ onLogin }) {
  const [error, setError] = useState(null),
    [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onLogin(
        await api("/login", {
          method: "POST",
          body: Object.fromEntries(new FormData(e.currentTarget)),
        }),
      );
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <div className="login-brand">
        <span className="brand-icon">
          <Monitor size={25} />
        </span>
        <strong>公司资产管理</strong>
      </div>
      <section className="login-panel">
        <div className="login-heading">
          <span className="eyebrow">ASSET WORKSPACE</span>
          <h1>登录资产工作台</h1>
        </div>
        <form onSubmit={submit}>
          <Field
            label="账号"
            name="username"
            autoComplete="username"
            required
            autoFocus
          />
          <Field
            label="密码"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
          <ErrorMessage error={error} />
          <button className="primary login-submit" disabled={busy}>
            {busy ? "登录中…" : "登录"}
            <ArrowRight size={17} />
          </button>
        </form>
      </section>
      <footer>企业设备 · 资产台账 · 交接记录</footer>
    </main>
  );
}

function AssetForm({ asset, employees, onClose, onSaved }) {
  const [form, setForm] = useState(
    asset
      ? Object.fromEntries(
          [...Object.keys(names), "owner_id", "user_id", "version"]
            .filter((k) => k in asset)
            .map((k) => [k, asset[k] ?? ""]),
        )
      : {
          code: "",
          name: "",
          category: "笔记本电脑",
          brand: "",
          model: "",
          serial: "",
          cpu: "",
          memory: "",
          disk: "",
          source: "new",
          entry_date: today(),
          purchase_date: "",
          purchase_amount: "",
          warranty_date: "",
          owner_id: "",
          user_id: "",
          status: "available",
          location: "",
          condition: "完好",
          accessories: "",
          notes: "",
          usage_date: "",
        },
  );
  const [error, setError] = useState(null),
    [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((old) => ({ ...old, [k]: v }));
  const field = (k, extra = {}) => (
    <Field
      key={k}
      label={names[k]}
      value={form[k] ?? ""}
      onChange={(e) => set(k, e.target.value)}
      {...extra}
    />
  );
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = { ...form };
      for (const k of [
        "owner_name",
        "owner_code",
        "owner_department",
        "user_name",
        "user_code",
        "user_department",
        "department",
        "role",
        "active",
        "username",
      ])
        delete body[k];
      if (asset)
        for (const k of ["owner_id", "user_id", "status", "usage_date"])
          delete body[k];
      const saved = await api(asset ? `/assets/${asset.id}` : "/assets", {
        method: asset ? "PUT" : "POST",
        body,
      });
      await onSaved(saved);
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={asset ? "编辑资产档案" : "登记资产"} wide onClose={onClose}>
      <form onSubmit={submit} className="dialog-body">
        <div className="form-section-title">基本信息</div>
        <div className="form-grid">
          {field("code", { placeholder: asset ? "" : "自动生成" })}
          {field("name", { required: true })}
          <Field label="设备类型">
            <select
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
            >
              {[...new Set([...CATEGORIES, form.category])].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          {field("brand")}
          {field("model")}
          {field("serial")}
          {field("cpu")}
          {field("memory")}
          {field("disk")}
          {field("location")}
        </div>
        <div className="form-section-title">归属与使用</div>
        {asset ? (
          <div className="ownership-summary">
            <div>
              <small>资产归属人</small>
              <strong>{asset.owner_name}</strong>
              <span>{asset.owner_department}</span>
            </div>
            <div>
              <small>当前使用人</small>
              <strong>{asset.user_name || "未分配"}</strong>
              <span>{asset.user_department || "-"}</span>
            </div>
          </div>
        ) : (
          <div className="form-grid">
            <Field label="登记来源">
              <select
                value={form.source}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    source: e.target.value,
                    status: "available",
                    user_id: "",
                    usage_date: "",
                  }))
                }
              >
                <option value="new">新增入库</option>
                <option value="existing">存量登记</option>
              </select>
            </Field>
            <PersonSelect
              label="资产归属人"
              employees={employees}
              activeOnly={form.source === "new"}
              value={form.owner_id}
              onChange={(v) => set("owner_id", v)}
              required
            />
            {form.source === "existing" && (
              <Field label="资产状态">
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      status: e.target.value,
                      user_id: "",
                      usage_date: "",
                    }))
                  }
                >
                  {Object.entries(STATUS)
                    .filter(([k]) => k !== "pending")
                    .map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                </select>
              </Field>
            )}
            {form.status === "in_use" && (
              <>
                <PersonSelect
                  label="当前使用人"
                  employees={employees}
                  value={form.user_id}
                  onChange={(v) => set("user_id", v)}
                  required
                />
                {field("usage_date", { type: "date" })}
              </>
            )}
          </div>
        )}
        <div className="form-section-title">入库与采购</div>
        <div className="form-grid">
          {field("entry_date", { type: "date", required: true })}
          {field("purchase_date", { type: "date" })}
          {field("purchase_amount", { type: "number", min: 0, step: "0.01" })}
          {field("warranty_date", { type: "date" })}
          {field("condition", { required: true })}
          {field("accessories")}
        </div>
        <Field label="备注">
          <textarea
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            rows={3}
          />
        </Field>
        <ErrorMessage error={error} />
        <div className="dialog-footer">
          <button type="button" onClick={onClose}>
            取消
          </button>
          <button className="primary" disabled={busy || employees.length === 0}>
            <Check size={16} />
            {busy ? "保存中…" : "保存资产"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ActionForm({ asset, action, employees, onClose, onSaved }) {
  const [form, setForm] = useState({
    version: asset.version,
    target_id: "",
    effective_date: today(),
    location: asset.location,
    condition: asset.condition,
    accessories: asset.accessories,
    notes: "",
    pending: false,
    needs_repair: false,
  });
  const [error, setError] = useState(null),
    [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSaved(
        await api(`/assets/${asset.id}/actions/${action}`, {
          method: "POST",
          body: form,
        }),
      );
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={ACTION[action]} onClose={onClose}>
      <form className="dialog-body" onSubmit={submit}>
        <div className="asset-context">
          <Laptop size={24} />
          <div>
            <strong>{asset.name}</strong>
            <span>{asset.code}</span>
          </div>
          <Badge status={asset.status} />
        </div>
        <div className="ownership-summary">
          <div>
            <small>资产归属人</small>
            <strong>{asset.owner_name}</strong>
          </div>
          <div>
            <small>当前使用人</small>
            <strong>{asset.user_name || "未分配"}</strong>
          </div>
        </div>
        {["assign", "transfer", "ownership"].includes(action) && (
          <PersonSelect
            label={action === "ownership" ? "新归属人" : "接收使用人"}
            employees={employees.filter(
              (e) =>
                String(e.id) !==
                String(
                  action === "ownership"
                    ? asset.owner_id
                    : action === "transfer"
                      ? asset.user_id
                      : 0,
                ),
            )}
            activeOnly
            value={form.target_id}
            onChange={(v) => set("target_id", v)}
            required
          />
        )}
        {action === "confirm" && (
          <div className="notice">
            待交接使用人：{asset.pending_handover?.target_name}（
            {asset.pending_handover?.target_code}）
          </div>
        )}
        <Field
          label={action === "ownership" ? "变更日期" : "交接日期"}
          type="date"
          max={today()}
          value={form.effective_date}
          onChange={(e) => set("effective_date", e.target.value)}
          required
        />
        {action !== "ownership" && (
          <>
            <Field
              label="位置"
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
            />
            <div className="form-grid">
              <Field
                label="设备状况"
                value={form.condition}
                onChange={(e) => set("condition", e.target.value)}
                required
              />
              <Field
                label="配件清单"
                value={form.accessories}
                onChange={(e) => set("accessories", e.target.value)}
              />
            </div>
          </>
        )}
        <Field
          label={
            action === "ownership"
              ? "归属变更原因"
              : action === "retire"
                ? "报废原因"
                : "交接备注"
          }
        >
          <textarea
            required={["ownership", "retire"].includes(action)}
            rows={3}
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </Field>
        {action === "assign" && (
          <label className="checkbox">
            <input
              type="checkbox"
              checked={form.pending}
              onChange={(e) => set("pending", e.target.checked)}
            />
            等待交接确认
          </label>
        )}
        {action === "return" && (
          <label className="checkbox">
            <input
              type="checkbox"
              checked={form.needs_repair}
              onChange={(e) => set("needs_repair", e.target.checked)}
            />
            归还后送修
          </label>
        )}
        <ErrorMessage error={error} />
        <div className="dialog-footer">
          <button type="button" onClick={onClose}>
            取消
          </button>
          <button className="primary" disabled={busy}>
            <Check size={16} />
            {busy
              ? "提交中…"
              : action === "confirm"
                ? "确认交接"
                : `确认${ACTION[action]}`}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EmployeeForm({ employee, onClose, onSaved }) {
  const [error, setError] = useState(null),
    [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(employee ? `/employees/${employee.id}` : "/employees", {
        method: employee ? "PUT" : "POST",
        body: Object.fromEntries(new FormData(e.currentTarget)),
      });
      await onSaved();
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={employee ? "编辑员工" : "新增员工"} onClose={onClose}>
      <form onSubmit={submit} className="dialog-body">
        <Field
          label="工号"
          name="code"
          required
          defaultValue={employee?.code}
        />
        <Field
          label="姓名"
          name="name"
          required
          defaultValue={employee?.name}
        />
        <Field
          label="部门"
          name="department"
          required
          defaultValue={employee?.department}
        />
        <Field label="任职状态">
          <select name="status" defaultValue={employee?.status || "active"}>
            <option value="active">在职</option>
            <option value="departed">已离职</option>
          </select>
        </Field>
        <ErrorMessage error={error} />
        <div className="dialog-footer">
          <button type="button" onClick={onClose}>
            取消
          </button>
          <button className="primary" disabled={busy}>
            <Check size={16} />
            保存员工
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AccountForm({ account, passwordOnly, onClose, onSaved }) {
  const [error, setError] = useState(null),
    [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = Object.fromEntries(new FormData(e.currentTarget));
      if (account) body.active = body.active === "true";
      await api(
        passwordOnly
          ? "/password"
          : account
            ? `/accounts/${account.id}`
            : "/accounts",
        { method: account ? "PUT" : "POST", body },
      );
      await onSaved();
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={passwordOnly ? "修改密码" : account ? "编辑账号" : "新增账号"}
      onClose={onClose}
    >
      <form className="dialog-body" onSubmit={submit}>
        {passwordOnly ? (
          <>
            <Field
              label="当前密码"
              name="current_password"
              type="password"
              autoComplete="current-password"
              required
            />
            <Field
              label="新密码"
              name="new_password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
              placeholder="至少 12 位"
            />
          </>
        ) : (
          <>
            {!account && (
              <Field
                label="登录账号"
                name="username"
                required
                pattern="[a-zA-Z0-9_.\-]{3,50}"
              />
            )}
            <Field
              label="显示名称"
              name="name"
              required
              defaultValue={account?.name}
            />
            <Field label="角色">
              <select name="role" defaultValue={account?.role || "viewer"}>
                <option value="viewer">只读</option>
                <option value="admin">管理员</option>
              </select>
            </Field>
            <Field
              label={account ? "重置密码" : "初始密码"}
              name="password"
              type="password"
              autoComplete="new-password"
              required={!account}
              minLength={12}
              placeholder={account ? "留空保留现有密码" : "至少 12 位"}
            />
            {account && (
              <Field label="账号状态">
                <select
                  name="active"
                  defaultValue={String(Boolean(account.active))}
                >
                  <option value="true">启用</option>
                  <option value="false">停用</option>
                </select>
              </Field>
            )}
          </>
        )}
        <ErrorMessage error={error} />
        <div className="dialog-footer">
          <button type="button" onClick={onClose}>
            取消
          </button>
          <button className="primary" disabled={busy}>
            <Check size={16} />
            保存
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ImportForm({ onClose, onSaved }) {
  const [csv, setCsv] = useState(""),
    [filename, setFilename] = useState(""),
    [result, setResult] = useState(null),
    [error, setError] = useState(null),
    [busy, setBusy] = useState(false);
  async function run(dry) {
    setBusy(true);
    setError(null);
    try {
      const response = await api(`/assets/import${dry ? "?dry_run=1" : ""}`, {
        method: "POST",
        body: csv,
        headers: { "Content-Type": "text/csv" },
      });
      if (dry) setResult(response);
      else {
        await onSaved();
        onClose();
      }
    } catch (err) {
      setError(err);
      setResult(null);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="批量导入资产" wide onClose={onClose}>
      <div className="dialog-body">
        <div className="import-toolbar">
          <a className="button" href={`${API}/assets/template`}>
            <Download size={16} />
            下载 CSV 模板
          </a>
          <span className="muted">UTF-8 CSV · 每批最多 500 条</span>
        </div>
        <label className="file-zone">
          <Upload size={28} />
          <strong>{filename || "选择资产文件"}</strong>
          <input
            type="file"
            accept=".csv,text/csv"
            aria-label="资产 CSV 文件"
            onChange={async (e) => {
              const file = e.target.files[0];
              setResult(null);
              setError(null);
              if (file) {
                if (file.size > 2 * 1024 * 1024) {
                  setError(new Error("文件不能超过 2 MB"));
                  setCsv("");
                  return;
                }
                setFilename(file.name);
                setCsv(await file.text());
              }
            }}
          />
        </label>
        {result && (
          <div className="success-message">
            <CheckCircle2 size={18} />
            校验通过，待导入 {result.count} 条资产
          </div>
        )}
        <ErrorMessage error={error} />
        <div className="dialog-footer">
          <button onClick={onClose}>取消</button>
          <button disabled={!csv || busy} onClick={() => run(true)}>
            <CheckCircle2 size={16} />
            校验文件
          </button>
          <button
            className="primary"
            disabled={!result || busy}
            onClick={() => run(false)}
          >
            <Upload size={16} />
            {busy ? "处理中…" : "确认导入"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function EventInfo({ event, onClose }) {
  const changes = Object.entries(names).filter(
    ([key]) =>
      event.before?.[key] !== event.after?.[key] &&
      (event.before?.[key] != null || event.after?.[key] != null),
  );
  return (
    <Modal title={ACTION[event.action] || event.action} wide onClose={onClose}>
      <div className="dialog-body">
        <div className="info-grid">
          <div>
            <small>操作人</small>
            <strong>{event.actor_name}</strong>
          </div>
          <div>
            <small>操作时间</small>
            <strong>{time(event.created_at)}</strong>
          </div>
          <div>
            <small>业务日期</small>
            <strong>{event.effective_date || "未登记"}</strong>
          </div>
          <div>
            <small>资产编号</small>
            <strong>{event.after?.code || event.before?.code || "-"}</strong>
          </div>
        </div>
        {event.details.notes && <p className="notice">{event.details.notes}</p>}
        {event.details.receiver && (
          <p>
            接收人：{event.details.receiver.name} ·{" "}
            {event.details.receiver.department}
          </p>
        )}
        {event.details.filename && <p>附件：{event.details.filename}</p>}
        {changes.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>字段</th>
                  <th>变更前</th>
                  <th>变更后</th>
                </tr>
              </thead>
              <tbody>
                {changes.map(([key, label]) => (
                  <tr key={key}>
                    <td>{label}</td>
                    <td>{display(key, event.before?.[key])}</td>
                    <td>{display(key, event.after?.[key])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}

function AssetDetail({
  asset,
  admin,
  onClose,
  onEdit,
  onAction,
  onEvent,
  onRefresh,
  notify,
}) {
  const [tab, setTab] = useState("detail"),
    [uploading, setUploading] = useState(false);
  const actions = {
    available: [
      ["assign", "分配", ArrowRight],
      ["repair", "送修", Wrench],
      ["retire", "报废", Ban],
    ],
    in_use: [
      ["transfer", "转交", ArrowLeftRight],
      ["return", "归还", Undo2],
    ],
    pending: [
      ["confirm", "确认交接", Check],
      ["cancel", "取消交接", X],
    ],
    repair: [
      ["restore", "维修完成", Check],
      ["retire", "报废", Ban],
    ],
    retired: [],
  };
  async function upload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      await api(`/assets/${asset.id}/attachments`, { method: "POST", body });
      await onRefresh();
      notify("附件已保存");
    } catch (err) {
      notify(err.message, true);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }
  return (
    <Modal title="资产详情" drawer onClose={onClose}>
      <div className="detail-body">
        <div className="detail-title">
          <div className="device-icon large">
            <Laptop size={30} />
          </div>
          <div>
            <span className="mono muted">{asset.code}</span>
            <h2>{asset.name}</h2>
            <span className="muted">
              {[asset.brand, asset.model].filter(Boolean).join(" · ") ||
                asset.category}
            </span>
          </div>
          <Badge status={asset.status} />
        </div>
        <div className="ownership-summary">
          <div>
            <small>资产归属人</small>
            <strong>{asset.owner_name}</strong>
            <span>
              {asset.owner_code} · {asset.owner_department}
            </span>
          </div>
          <div>
            <small>当前使用人</small>
            <strong>{asset.user_name || "未分配"}</strong>
            <span>
              {asset.user_id
                ? `${asset.user_code} · ${asset.user_department}`
                : "-"}
            </span>
          </div>
        </div>
        {asset.pending_handover && (
          <div className="notice">
            待交接：{asset.pending_handover.target_name} ·{" "}
            {asset.pending_handover.target_code}
          </div>
        )}
        {asset.user_status === "departed" && (
          <div className="warning-message">
            <AlertCircle size={17} />
            使用人已离职，设备待归还
          </div>
        )}
        {asset.owner_status === "departed" && (
          <div className="warning-message">
            <AlertCircle size={17} />
            归属人已离职，待变更归属
          </div>
        )}
        {admin && (
          <div className="asset-actions">
            {actions[asset.status].map(([key, label, Icon], i) => (
              <button
                key={key}
                className={i === 0 ? "primary" : ""}
                onClick={() => onAction(key)}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
            <button onClick={() => onAction("ownership")}>
              <UserRound size={16} />
              变更归属
            </button>
            <IconButton icon={Pencil} label="编辑资产" onClick={onEdit} />
          </div>
        )}
        <div className="tabs">
          {[
            ["detail", "资产档案"],
            ["history", `流转记录 ${asset.events.length}`],
            ["files", `附件 ${asset.attachments.length}`],
          ].map(([key, label]) => (
            <button
              key={key}
              className={tab === key ? "active" : ""}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === "detail" && (
          <div className="info-grid">
            {[
              "category",
              "serial",
              "cpu",
              "memory",
              "disk",
              "location",
              "condition",
              "accessories",
              "source",
              "entry_date",
              "purchase_date",
              "purchase_amount",
              "warranty_date",
              "usage_date",
              "notes",
            ].map((k) => (
              <div key={k} className={k === "notes" ? "full" : ""}>
                <small>{names[k]}</small>
                <strong>{display(k, asset[k])}</strong>
              </div>
            ))}
          </div>
        )}
        {tab === "history" && (
          <div className="timeline">
            {asset.events.map((event) => (
              <button
                className="timeline-item"
                key={event.id}
                onClick={() => onEvent(event)}
              >
                <span className="timeline-dot" />
                <div>
                  <div className="timeline-top">
                    <strong>{ACTION[event.action]}</strong>
                    <span>
                      {event.effective_date || time(event.created_at)}
                    </span>
                  </div>
                  <p>
                    {event.action === "ownership"
                      ? `${event.before?.owner_name} → ${event.after?.owner_name}`
                      : event.details.receiver
                        ? `接收人：${event.details.receiver.name} · ${event.details.receiver.department}`
                        : event.action === "return"
                          ? `${event.before?.user_name} 归还设备`
                          : event.details.notes ||
                            event.details.filename ||
                            "已记录"}
                  </p>
                  <small>
                    {event.actor_name} · {time(event.created_at)}
                  </small>
                </div>
                <ChevronRight size={15} />
              </button>
            ))}
          </div>
        )}
        {tab === "files" && (
          <div className="attachments">
            {admin && (
              <label className={`button ${uploading ? "disabled" : ""}`}>
                <Paperclip size={16} />
                {uploading ? "上传中…" : "添加附件"}
                <input
                  disabled={uploading}
                  hidden
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={upload}
                  aria-label="上传附件"
                />
              </label>
            )}
            {asset.attachments.length ? (
              asset.attachments.map((file) => (
                <a
                  className="attachment"
                  key={file.id}
                  href={`${API}/attachments/${file.id}`}
                >
                  <Paperclip size={18} />
                  <div>
                    <strong>{file.original_name}</strong>
                    <small>
                      {Math.ceil(file.size / 1024)} KB · {time(file.created_at)}
                    </small>
                  </div>
                  <Download size={17} />
                </a>
              ))
            ) : (
              <Empty text="暂无附件" icon={Paperclip} />
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

function App() {
  const [me, setMe] = useState(undefined),
    [page, setPage] = useState("assets"),
    [employees, setEmployees] = useState([]),
    [stats, setStats] = useState(null),
    [assets, setAssets] = useState({ items: [], total: 0 }),
    [events, setEvents] = useState({ items: [], total: 0 }),
    [accounts, setAccounts] = useState([]),
    [filters, setFilters] = useState(initialFilters),
    [assetPage, setAssetPage] = useState(1),
    [eventPage, setEventPage] = useState(1),
    [eventCategory, setEventCategory] = useState("device"),
    [employeeQuery, setEmployeeQuery] = useState(""),
    [detail, setDetail] = useState(null),
    [modal, setModal] = useState(null),
    [toast, setToast] = useState(null),
    [busy, setBusy] = useState(false),
    [loadError, setLoadError] = useState(null),
    [revision, setRevision] = useState(0);
  const request = useRef(0),
    toastTimer = useRef(null);
  const admin = me?.role === "admin";
  const notify = (message, error = false) => {
    setToast({ message, error });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  };
  useEffect(() => {
    api("/me")
      .then(setMe)
      .catch(() => setMe(null));
    const expired = () => {
      setMe(null);
      setDetail(null);
      setModal(null);
    };
    window.addEventListener("session-expired", expired);
    return () => window.removeEventListener("session-expired", expired);
  }, []);
  useEffect(() => {
    if (!me) return;
    let disposed = false;
    Promise.all([api("/employees"), api("/stats")])
      .then(([e, s]) => {
        if (!disposed) {
          setEmployees(e);
          setStats(s);
        }
      })
      .catch((err) => {
        if (!disposed) notify(err.message, true);
      });
    return () => {
      disposed = true;
    };
  }, [me, revision]);
  const query = new URLSearchParams(
    Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
  ).toString();
  useEffect(() => {
    if (!me) return;
    const seq = ++request.current;
    setBusy(true);
    setLoadError(null);
    const run = async () => {
      try {
        if (page === "assets") {
          const r = await api(`/assets?${query}&page=${assetPage}&pageSize=15`);
          if (seq === request.current) setAssets(r);
        } else if (page === "events") {
          const r = await api(
            `/events?page=${eventPage}&category=${eventCategory}`,
          );
          if (seq === request.current) setEvents(r);
        } else if (page === "accounts" && admin) {
          const r = await api("/accounts");
          if (seq === request.current) setAccounts(r);
        }
      } catch (err) {
        if (seq === request.current) setLoadError(err);
      } finally {
        if (seq === request.current) setBusy(false);
      }
    };
    const timer = setTimeout(run, filters.q ? 180 : 0);
    return () => clearTimeout(timer);
  }, [me, page, query, assetPage, eventPage, eventCategory, revision]);
  const selectEventCategory = (key) => {
    setEventCategory(key);
    setEventPage(1);
    setEvents((previous) => ({ ...previous, items: [], total: 0 }));
  };
  const refresh = async (saved) => {
    setRevision((r) => r + 1);
    if (detail) {
      try {
        setDetail(await api(`/assets/${detail.id}`));
      } catch (err) {
        notify(err.message, true);
      }
    }
  };
  const saved = async () => {
    await refresh();
    notify("保存成功");
  };
  const changeFilter = (key, value) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setAssetPage(1);
  };
  const openDetail = async (assetId) => {
    try {
      setDetail(await api(`/assets/${assetId}`));
    } catch (err) {
      notify(err.message, true);
    }
  };
  const showPersonAssets = (key, value) => {
    setFilters({ ...initialFilters, [key]: String(value) });
    setAssetPage(1);
    setPage("assets");
  };
  const logout = async () => {
    try {
      await api("/logout", { method: "POST" });
      setMe(null);
      setDetail(null);
      setModal(null);
    } catch (err) {
      notify(err.message, true);
    }
  };
  if (me === undefined)
    return (
      <div className="app-loading">
        <RefreshCw size={24} />
        正在加载
      </div>
    );
  if (!me)
    return (
      <Login
        onLogin={(user) => {
          setMe(user);
          setPage("assets");
          setFilters(initialFilters);
          setAssetPage(1);
          setEventPage(1);
          setEventCategory("device");
        }}
      />
    );
  const navigation = [
    ["assets", "资产台账", Monitor],
    ["events", "交接与日志", ClipboardList],
    ["employees", "员工与部门", Users],
    ["overview", "统计概览", LayoutDashboard],
    ...(admin ? [["accounts", "账号权限", ShieldCheck]] : []),
  ];
  const currentTitle = navigation.find(([key]) => key === page)?.[1];
  const employeeRows = employees.filter((e) =>
    [e.name, e.code, e.department].some((v) => v.includes(employeeQuery)),
  );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon">
            <Monitor size={23} />
          </span>
          <div>
            <strong>公司资产管理</strong>
            <small>ASSET WORKSPACE</small>
          </div>
        </div>
        <span className="nav-label">工作空间</span>
        <nav>
          {navigation.map(([key, label, Icon]) => (
            <button
              key={key}
              className={page === key ? "active" : ""}
              onClick={() => setPage(key)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {key === "assets" && <small>{stats?.total ?? 0}</small>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="workspace-status">
            <span />
            资产管理系统
          </div>
          <div className="account">
            <span className="avatar">{me.name.slice(0, 1)}</span>
            <div>
              <strong>{me.name}</strong>
              <small>{admin ? "资产管理员" : "只读账号"}</small>
            </div>
            <IconButton
              icon={KeyRound}
              label="修改密码"
              onClick={() => setModal({ type: "password" })}
            />
            <IconButton icon={LogOut} label="退出登录" onClick={logout} />
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div>
            <span>工作空间</span>
            <ChevronRight size={14} />
            <strong>{currentTitle}</strong>
          </div>
          <span className="today">
            {new Date().toLocaleDateString("zh-CN", {
              year: "numeric",
              month: "long",
              day: "numeric",
              weekday: "long",
            })}
          </span>
          <IconButton
            icon={RefreshCw}
            label="刷新数据"
            onClick={() => setRevision((r) => r + 1)}
          />
        </header>
        <div className="workspace">
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {
                  {
                    assets: "ASSET REGISTER",
                    events: "ACTIVITY LOG",
                    employees: "PEOPLE & DEPARTMENTS",
                    overview: "OVERVIEW",
                    accounts: "ACCESS CONTROL",
                  }[page]
                }
              </span>
              <h1>{currentTitle}</h1>
            </div>
            <div className="page-actions">
              {page === "assets" && (
                <>
                  <a href={`${API}/assets/export?${query}`} className="button">
                    <Download size={16} />
                    <span>导出</span>
                  </a>
                  {admin && (
                    <>
                      <button onClick={() => setModal({ type: "import" })}>
                        <Upload size={16} />
                        <span>导入</span>
                      </button>
                      <button
                        className="primary"
                        onClick={() => setModal({ type: "asset" })}
                      >
                        <Plus size={17} />
                        <span>登记资产</span>
                      </button>
                    </>
                  )}
                </>
              )}
              {page === "employees" && admin && (
                <button
                  className="primary"
                  onClick={() => setModal({ type: "employee" })}
                >
                  <Plus size={17} />
                  新增员工
                </button>
              )}
              {page === "accounts" && admin && (
                <button
                  className="primary"
                  onClick={() => setModal({ type: "account" })}
                >
                  <Plus size={17} />
                  新增账号
                </button>
              )}
            </div>
          </div>
          {loadError ? (
            <div className="page-error">
              <ErrorMessage error={loadError} />
              <button onClick={() => setRevision((r) => r + 1)}>
                重新加载
              </button>
            </div>
          ) : (
            <>
              {(page === "assets" || page === "overview") && (
                <div className="metrics">
                  {[
                    ["全部资产", stats?.total ?? 0, Package, "total"],
                    [
                      "待分配",
                      stats?.counts.available ?? 0,
                      Monitor,
                      "available",
                    ],
                    ["使用中", stats?.counts.in_use ?? 0, UserRound, "in_use"],
                    [
                      "待交接",
                      stats?.counts.pending ?? 0,
                      ArrowLeftRight,
                      "pending",
                    ],
                    ["维修中", stats?.counts.repair ?? 0, Wrench, "repair"],
                  ].map(([label, count, Icon, key]) => (
                    <button
                      key={key}
                      className={`metric ${key}`}
                      onClick={() => {
                        setPage("assets");
                        changeFilter("status", key === "total" ? "" : key);
                      }}
                    >
                      <div>
                        <span>{label}</span>
                        <Icon size={18} />
                      </div>
                      <strong>
                        {count}
                        <small>台</small>
                      </strong>
                    </button>
                  ))}
                </div>
              )}
              {page === "assets" && (
                <>
                  {stats?.warnings.departed_users > 0 && (
                    <button
                      className="warning-banner"
                      onClick={() =>
                        changeFilter("departed", filters.departed ? "" : "1")
                      }
                    >
                      <AlertCircle size={17} />
                      <span>
                        {stats.warnings.departed_users} 台设备仍由离职员工使用
                      </span>
                      <span>
                        {filters.departed ? "显示全部" : "查看设备"}
                        <ChevronRight size={15} />
                      </span>
                    </button>
                  )}
                  <div className="filter-bar">
                    <div className="search-input">
                      <Search size={18} />
                      <input
                        aria-label="搜索资产"
                        placeholder="搜索资产编号、设备、序列号或人员"
                        value={filters.q}
                        onChange={(e) => changeFilter("q", e.target.value)}
                      />
                      {filters.q && (
                        <IconButton
                          icon={X}
                          label="清空搜索"
                          onClick={() => changeFilter("q", "")}
                        />
                      )}
                    </div>
                    <select
                      aria-label="筛选状态"
                      value={filters.status}
                      onChange={(e) => changeFilter("status", e.target.value)}
                    >
                      <option value="">全部状态</option>
                      {Object.entries(STATUS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="筛选部门"
                      value={filters.department}
                      onChange={(e) =>
                        changeFilter("department", e.target.value)
                      }
                    >
                      <option value="">全部部门</option>
                      {[...new Set(employees.map((e) => e.department))]
                        .sort()
                        .map((d) => (
                          <option key={d}>{d}</option>
                        ))}
                    </select>
                  </div>
                  <div className="person-filters">
                    <PersonSelect
                      label="归属人"
                      employees={employees}
                      value={filters.owner_id}
                      onChange={(v) => changeFilter("owner_id", v)}
                    />
                    <PersonSelect
                      label="使用人"
                      employees={employees}
                      value={filters.user_id}
                      onChange={(v) => changeFilter("user_id", v)}
                    />
                    {Object.values(filters).some(Boolean) && (
                      <button
                        className="text-button"
                        onClick={() => {
                          setFilters(initialFilters);
                          setAssetPage(1);
                        }}
                      >
                        清除筛选
                      </button>
                    )}
                    <span className="result-count">
                      {busy ? "加载中…" : `${assets.total} 条资产`}
                    </span>
                  </div>
                  <div className="table-wrap asset-table">
                    <table>
                      <thead>
                        <tr>
                          <th>资产 / 设备</th>
                          <th>资产归属人</th>
                          <th>当前使用人</th>
                          <th>状态</th>
                          <th>位置</th>
                          <th>入库日期</th>
                          <th className="asset-operation">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assets.items.map((asset) => (
                          <tr key={asset.id}>
                            <td>
                              <button
                                className="asset-cell"
                                onClick={() => openDetail(asset.id)}
                              >
                                <span className="device-icon">
                                  {asset.category === "笔记本电脑" ? (
                                    <Laptop size={21} />
                                  ) : (
                                    <Monitor size={21} />
                                  )}
                                </span>
                                <span>
                                  <strong>{asset.name}</strong>
                                  <small>
                                    {asset.code} ·{" "}
                                    {asset.model || asset.category}
                                  </small>
                                </span>
                              </button>
                            </td>
                            <td>
                              <div className="person-cell">
                                <strong>{asset.owner_name}</strong>
                                <small>
                                  {asset.owner_department}
                                  {asset.owner_status === "departed"
                                    ? " · 已离职"
                                    : ""}
                                </small>
                              </div>
                            </td>
                            <td>
                              <div className="person-cell">
                                <strong
                                  className={asset.user_name ? "" : "muted"}
                                >
                                  {asset.user_name || "未分配"}
                                </strong>
                                <small
                                  className={
                                    asset.user_status === "departed"
                                      ? "danger-text"
                                      : ""
                                  }
                                >
                                  {asset.user_id
                                    ? `${asset.user_department}${asset.user_status === "departed" ? " · 已离职" : ""}`
                                    : "-"}
                                </small>
                              </div>
                            </td>
                            <td>
                              <Badge status={asset.status} />
                            </td>
                            <td>{asset.location || "-"}</td>
                            <td className="date-cell">{asset.entry_date}</td>
                            <td className="asset-operation">
                              <button
                                type="button"
                                className="asset-detail-button"
                                aria-label={`查看详情 ${asset.code}`}
                                aria-haspopup="dialog"
                                onClick={() => openDetail(asset.id)}
                              >
                                <PanelRightOpen size={16} />
                                查看详情
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!assets.items.length && !busy && (
                      <Empty
                        text={
                          Object.values(filters).some(Boolean)
                            ? "没有符合条件的资产"
                            : "暂无资产"
                        }
                      >
                        {admin && !Object.values(filters).some(Boolean) && (
                          <button
                            className="primary"
                            onClick={() =>
                              setModal({
                                type: employees.length ? "asset" : "employee",
                              })
                            }
                          >
                            <Plus size={16} />
                            {employees.length ? "登记资产" : "新增员工"}
                          </button>
                        )}
                      </Empty>
                    )}
                  </div>
                  <Pager
                    page={assetPage}
                    total={assets.total}
                    pageSize={15}
                    onChange={setAssetPage}
                  />
                </>
              )}
              {page === "employees" && (
                <>
                  <div className="filter-bar">
                    <div className="search-input">
                      <Search size={18} />
                      <input
                        aria-label="搜索员工"
                        placeholder="搜索姓名、工号或部门"
                        value={employeeQuery}
                        onChange={(e) => setEmployeeQuery(e.target.value)}
                      />
                    </div>
                    <span className="muted">{employeeRows.length} 位员工</span>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>姓名 / 工号</th>
                          <th>部门</th>
                          <th>任职状态</th>
                          <th>归属资产</th>
                          <th>使用设备</th>
                          <th>操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employeeRows.map((e) => (
                          <tr key={e.id}>
                            <td>
                              <div className="employee-cell">
                                <span className="avatar">
                                  {e.name.slice(0, 1)}
                                </span>
                                <div>
                                  <strong>{e.name}</strong>
                                  <small>{e.code}</small>
                                </div>
                              </div>
                            </td>
                            <td>{e.department}</td>
                            <td>
                              <span
                                className={`badge ${e.status === "active" ? "available" : "retired"}`}
                              >
                                <i />
                                {e.status === "active" ? "在职" : "已离职"}
                              </span>
                            </td>
                            <td>
                              <button
                                className="number-link"
                                onClick={() =>
                                  showPersonAssets("owner_id", e.id)
                                }
                              >
                                {e.owned_count} 台
                              </button>
                            </td>
                            <td>
                              <button
                                className={`number-link ${e.status === "departed" && e.used_count ? "danger-text" : ""}`}
                                onClick={() =>
                                  showPersonAssets("user_id", e.id)
                                }
                              >
                                {e.used_count} 台
                              </button>
                            </td>
                            <td>
                              {admin && (
                                <IconButton
                                  icon={Pencil}
                                  label={`编辑员工 ${e.name}`}
                                  onClick={() =>
                                    setModal({ type: "employee", employee: e })
                                  }
                                />
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!employeeRows.length && (
                      <Empty text="暂无员工" icon={Users} />
                    )}
                  </div>
                </>
              )}
              {page === "events" && (
                <>
                  <div
                    className="tabs event-tabs"
                    role="tablist"
                    aria-label="日志类型"
                  >
                    {EVENT_CATEGORIES.map(({ key, label }, index) => {
                      const Icon = [
                        Monitor,
                        ArrowLeftRight,
                        Users,
                        ShieldCheck,
                      ][index];
                      return (
                        <button
                          key={key}
                          type="button"
                          role="tab"
                          id={`event-tab-${key}`}
                          aria-controls="event-panel"
                          aria-selected={eventCategory === key}
                          tabIndex={eventCategory === key ? 0 : -1}
                          className={eventCategory === key ? "active" : ""}
                          onClick={() => selectEventCategory(key)}
                          onKeyDown={(event) => {
                            const offsets = { ArrowRight: 1, ArrowLeft: -1 };
                            const next =
                              event.key === "Home"
                                ? 0
                                : event.key === "End"
                                  ? EVENT_CATEGORIES.length - 1
                                  : offsets[event.key]
                                    ? (index +
                                        offsets[event.key] +
                                        EVENT_CATEGORIES.length) %
                                      EVENT_CATEGORIES.length
                                    : null;
                            if (next === null) return;
                            event.preventDefault();
                            selectEventCategory(EVENT_CATEGORIES[next].key);
                            document
                              .getElementById(
                                `event-tab-${EVENT_CATEGORIES[next].key}`,
                              )
                              .focus();
                          }}
                        >
                          <Icon size={17} />
                          {label}
                          <span className="event-tab-count">
                            {events.counts?.[key] ?? 0}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <section
                    id="event-panel"
                    role="tabpanel"
                    aria-labelledby={`event-tab-${eventCategory}`}
                    aria-busy={busy}
                  >
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>操作</th>
                            <th>
                              {eventCategory === "people"
                                ? "员工"
                                : eventCategory === "account"
                                  ? "账号"
                                  : "资产"}
                            </th>
                            {["device", "handover"].includes(eventCategory) ? (
                              <>
                                <th>归属人</th>
                                <th>使用人 / 接收人</th>
                              </>
                            ) : (
                              <th>
                                {eventCategory === "people" ? "部门" : "角色"}
                              </th>
                            )}
                            <th>操作人</th>
                            <th>业务日期</th>
                            <th>记录时间</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {events.items.map((e) => (
                            <tr key={e.id}>
                              <td>
                                <strong>{ACTION[e.action]}</strong>
                              </td>
                              <td>
                                {e.asset_id ? (
                                  <button
                                    className="text-button"
                                    onClick={() => openDetail(e.asset_id)}
                                  >
                                    {e.asset_code}
                                  </button>
                                ) : (
                                  <div className="person-cell">
                                    <strong>
                                      {e.after?.name ||
                                        e.before?.name ||
                                        e.actor_name}
                                    </strong>
                                    <small>
                                      {e.after?.code ||
                                        e.before?.code ||
                                        e.after?.username ||
                                        e.before?.username ||
                                        "-"}
                                    </small>
                                  </div>
                                )}
                              </td>
                              {["device", "handover"].includes(
                                eventCategory,
                              ) ? (
                                <>
                                  <td>
                                    {e.after?.owner_name ||
                                      e.before?.owner_name ||
                                      "-"}
                                  </td>
                                  <td>
                                    {e.details.receiver?.name ||
                                      e.after?.user_name ||
                                      e.before?.user_name ||
                                      "-"}
                                  </td>
                                </>
                              ) : (
                                <td>
                                  {eventCategory === "people"
                                    ? e.after?.department ||
                                      e.before?.department ||
                                      "-"
                                    : e.after?.role || e.before?.role
                                      ? display(
                                          "role",
                                          e.after?.role || e.before?.role,
                                        )
                                      : "-"}
                                </td>
                              )}
                              <td>{e.actor_name}</td>
                              <td>{e.effective_date || "-"}</td>
                              <td className="date-cell">
                                {time(e.created_at)}
                              </td>
                              <td>
                                <IconButton
                                  icon={ChevronRight}
                                  label={`查看记录 ${e.id}`}
                                  onClick={() =>
                                    setModal({ type: "event", event: e })
                                  }
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!events.items.length && !busy && (
                        <Empty text="暂无操作记录" icon={History} />
                      )}
                    </div>
                    <Pager
                      page={eventPage}
                      total={events.total}
                      pageSize={30}
                      onChange={setEventPage}
                    />
                  </section>
                </>
              )}
              {page === "overview" && stats && (
                <>
                  <div className="overview-totals">
                    <div>
                      <small>在册资产采购金额</small>
                      <strong>{money(stats.value)}</strong>
                    </div>
                    <div>
                      <small>在职员工</small>
                      <strong>
                        {stats.employees}
                        <span>人</span>
                      </strong>
                    </div>
                    <div>
                      <small>已报废设备</small>
                      <strong>
                        {stats.counts.retired || 0}
                        <span>台</span>
                      </strong>
                    </div>
                  </div>
                  <div className="section-heading">
                    <Building2 size={20} />
                    <h2>部门资产分布</h2>
                    <span>按资产归属部门统计</span>
                  </div>
                  <div className="department-list">
                    {stats.departments.length ? (
                      stats.departments.map((d) => (
                        <button
                          key={d.department}
                          className="department-row"
                          onClick={() => {
                            setFilters({
                              ...initialFilters,
                              department: d.department,
                            });
                            setAssetPage(1);
                            setPage("assets");
                          }}
                        >
                          <strong>{d.department}</strong>
                          <div className="bar-track">
                            <div
                              style={{
                                width: `${(d.count / Math.max(...stats.departments.map((x) => x.count))) * 100}%`,
                              }}
                            />
                          </div>
                          <span>{d.count} 台</span>
                          <small>使用中 {d.in_use}</small>
                          <ChevronRight size={16} />
                        </button>
                      ))
                    ) : (
                      <Empty text="暂无部门资产" />
                    )}
                  </div>
                  <div className="section-heading">
                    <AlertCircle size={20} />
                    <h2>待关注事项</h2>
                  </div>
                  <div className="attention-list">
                    <div>
                      <span>离职员工未归还</span>
                      <strong>{stats.warnings.departed_users} 台</strong>
                    </div>
                    <div>
                      <span>归属人已离职</span>
                      <strong>{stats.warnings.departed_owners} 台</strong>
                    </div>
                    <div>
                      <span>30 天内保修到期</span>
                      <strong>{stats.warnings.warranty_expiring} 台</strong>
                    </div>
                  </div>
                </>
              )}
              {page === "accounts" && admin && (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>账号</th>
                        <th>显示名称</th>
                        <th>角色</th>
                        <th>状态</th>
                        <th>创建时间</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accounts.map((a) => (
                        <tr key={a.id}>
                          <td className="mono">{a.username}</td>
                          <td>{a.name}</td>
                          <td>{a.role === "admin" ? "管理员" : "只读"}</td>
                          <td>
                            <span
                              className={`badge ${a.active ? "available" : "retired"}`}
                            >
                              <i />
                              {a.active ? "启用" : "停用"}
                            </span>
                          </td>
                          <td>{time(a.created_at)}</td>
                          <td>
                            <IconButton
                              icon={Pencil}
                              label={`编辑账号 ${a.username}`}
                              onClick={() =>
                                setModal({ type: "account", account: a })
                              }
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </main>
      {detail && (
        <AssetDetail
          asset={detail}
          admin={admin}
          onClose={() => setDetail(null)}
          onEdit={() => setModal({ type: "asset", asset: detail })}
          onAction={(action) => setModal({ type: "action", action })}
          onEvent={(event) => setModal({ type: "event", event })}
          onRefresh={refresh}
          notify={notify}
        />
      )}{" "}
      {modal?.type === "asset" && (
        <AssetForm
          asset={modal.asset}
          employees={employees}
          onClose={() => setModal(null)}
          onSaved={saved}
        />
      )}{" "}
      {modal?.type === "action" && (
        <ActionForm
          asset={detail}
          action={modal.action}
          employees={employees}
          onClose={() => setModal(null)}
          onSaved={saved}
        />
      )}{" "}
      {modal?.type === "employee" && (
        <EmployeeForm
          employee={modal.employee}
          onClose={() => setModal(null)}
          onSaved={saved}
        />
      )}{" "}
      {modal?.type === "import" && (
        <ImportForm onClose={() => setModal(null)} onSaved={saved} />
      )}{" "}
      {modal?.type === "event" && (
        <EventInfo event={modal.event} onClose={() => setModal(null)} />
      )}{" "}
      {(modal?.type === "account" || modal?.type === "password") && (
        <AccountForm
          account={modal.account}
          passwordOnly={modal.type === "password"}
          onClose={() => setModal(null)}
          onSaved={
            modal.type === "password"
              ? () => {
                  setMe(null);
                  setDetail(null);
                }
              : saved
          }
        />
      )}{" "}
      {toast && (
        <div
          role={toast.error ? "alert" : "status"}
          className={`toast ${toast.error ? "error" : ""}`}
        >
          {toast.error ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.message}</span>
          <IconButton
            icon={X}
            label="关闭通知"
            onClick={() => setToast(null)}
          />
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
