import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  FileCode, 
  Copy, 
  Check, 
  Download, 
  Sparkles, 
  Layers, 
  Database, 
  Cpu, 
  CheckCircle2, 
  Smartphone 
} from 'lucide-react';

export const PromptStudio: React.FC = () => {
  const { showToast } = useApp();
  const [activeTab, setActiveTab] = useState<'prompt' | 'tech_spec' | 'schema' | 'ux_flows'>('prompt');
  const [targetTech, setTargetTech] = useState<'flutter' | 'react_native' | 'react_web' | 'kotlin'>('flutter');
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // The comprehensive, structured prompt
  const masterPrompt = `### برومت هندسي شامل ومتقدم: تطبيق جوال لتنظيم العمليات بين المتجر والعملاء ونقاط البيع (DigiPOS Platform)

**الهدف الرئيسي:**
قم ببرمجة وبناء تطبيق جوال احترافي (${targetTech === 'flutter' ? 'Flutter / Dart' : targetTech === 'react_native' ? 'React Native / Expo' : targetTech === 'kotlin' ? 'Android Native (Kotlin & Jetpack Compose)' : 'React SPA (TypeScript & Tailwind)'}) ينظم العمليات التجارية والمالية بين المستخدم الأعلى ويسمى **المتجر** (الذي يقوم بتوريد الخدمات وبيعها على العميل)، و**العميل** (الذي يملك رصيداً مسبقاً في محفظته لدى المتجر)، مع فرض واقتطاع رسوم على كل عملية شراء خدمات أو تحويل رصيد لحساب **مدير التطبيق**.

يتكون التطبيق من ثلاث واجهات رئيسية ومستقلة:

---

### الواجهة الأولى: واجهة العميل (لوحة تحكم العميل ونقطة البيع):
تحتوي لوحة تحكم العميل على الأدوات التالية:
1. **طلب شحن رصيد مسبق للمحفظة:**
   - استعراض بيانات الحساب البنكي للمتجر.
   - إدخال المبلغ المراد شحنه، رقم الحوالة البنكية، اسم المحول، والبنك المحول منه، ورفع الإشعار.
   - إرسال الطلب للمتجر لمراجعته وإيداعه في المحفظة فور التأكد.
2. **متجر الخدمات الرقمية المتاحة للشراء من المتجر:**
   - تصفح الكاتالوجات والخدمات والباقات.
   - تظهر الأسعار تلقائياً بناءً على رتبة حساب العميل (عادي، نحاسي، فضي، ذهبي، مميز) مع توضيح نسبة الخصم.
   - 3 طرق لتسليم الخدمة:
     - **عبر الأيدي (إرسال للمتجر للشحن من اللعبة):** إدخال الأيدي مع زر "تحقق من الأيدي"، وعند الدفع يرتسل الطلب مع الأيدي مباشرة إلى المتجر ليكمل شحن الحساب من داخل اللعبة باستخدام الأيدي.
     - **فوري عبر الحساب:** إدخال الإيميل وكلمة المرور ثم إدخال رمز التحقق (OTP) من إشعارات البريد مع التحقق والتنبيه عند أي خطأ في البيانات.
     - **عبر تسليم الكود:** كود قسيمة رقمي يظهر فوراً في رسالة جاهزة للنسخ بنقرة واحدة.
   - الدفع إما من رصيد المحفظة المسبق (مع خصم قيمة الخدمة + الرسوم) أو عبر بطاقات الفيزا كارد.
3. **تحويل رصيد إلى عميل آخر عبر المعرف أو الكيو أر (QR Code):**
   - إدخال المعرف المكون من 3 أحرف و 5 أرقام (مثال: RYD-10492) أو مسح رمز الكيو أر (QR) للمستلم بالكاميرا.
   - إدخال المبلغ واحتساب الرسوم تلقائياً وخصم الإجمالي من المحفظة وإيداع المبلغ للمستلم.
4. **كشف حساب المحفظة والمشتريات والمبيعات:**
   - سجل حركة القيود المحاسبية للمحفظة مع فلاتر مخصصة (عام، مبيعات للزبائن، مشتريات من المتجر، تحويل رصيد، شحن رصيد، فلترة حسب الزبون، فلترة حسب الخدمة) مع زر الطباعة.

---

### الواجهة الثانية: واجهة المتجر (الممول الأعلى):
تحتوي لوحة تحكم المتجر على الأدوات التالية:
1. **مراجعة طلبات شحن الرصيد والموافقة عليها:**
   - استعراض طلبات الإيداع الواردة من العملاء.
   - مطابقة رقم الحوالة واسم المحول مع كشف الحساب البنكي للمتجر واعتماد الشحن فوراً لتغذية محفظة العميل.
2. **إدارة الكاتالوجات والخدمات والأكواد الرقمية (مخزون الأكواد):**
   - إضافة نوع كاتالوج جديد (ألعاب، بطاقات، اشتراكات، برامج).
   - إضافة خدمات رقمية وباقاتها وتحديد جدول أسعار الرتب الخمس:
     - مميز ٦٠ ر.س · ذهبي ٧٠ ر.س · فضي ٨٠ ر.س · نحاسي ٩٠ ر.س · عادي ١٠٠ ر.س.
   - إضافة وتغذية الأكواد الرقمية والقسائم الجاهزة للتسليم التلقائي.
3. **طلبات الخدمات الواردة التي تحتاج إلى إتمام وتنفيذ من المتجر:**
   - قسم خاص بالطلبات عبر الأيدي أو عبر الحساب التي تتطلب تنفيذ المتجر يدوياً أو عبر بوابات خاصة.
   - يرى المتجر بيانات الأيدي أو بيانات الحساب ورمز التحقق OTP المدخل، ويقوم بإتمام الشحن وتحديث حالة الطلب إلى "تم الإنجاز بنجاح" أو إلغاء الطلب واسترداد الرصيد للعميل.
4. **إدارة العملاء والوكلاء وترقية الرتب وروابط الدعوة:**
   - ترقية رتبة أي عميل بضغطة زر إلى (نحاسي، فضي، ذهبي، مميز).
   - توليد روابط تسجيل تمنح رتبة محددة مسبقاً (مثلاً رابط برتبة مميز مباشرة).
5. **كشف حساب للعملاء ومشترياتهم وإيداعاتهم:**
   - استعراض حركة كل عميل ومشترياته وإيداعاته وسجل قيوده المحاسبية وطباعتها.

---

### الواجهة الثالثة: واجهة مدير التطبيق (Super Admin Dashboard):
تحتوي لوحة تحكم مدير التطبيق على الأدوات التالية:
1. **إضافة الممولين/المتاجر والإشراف عليهم:**
   - إضافة متاجرن جدد للمنصة، ربط حساباتهم البنكية ومتاجرهم، أو إرسال روابط تسجيل لمتاجر جدد.
   - الإشراف على مبيعات ومحافظ كل متجر وشبكة وكلائه.
2. **إدارة وتعديل نسبة ومبلغ الرسوم على بيع وشراء الخدمات وتحويل الرصيد:**
   - إمكانية تحديد الرسوم كـ:
     - **نسبة مئوية (%)** (افتراضياً 1% من قيمة العملية).
     - **أو مبلغ مقطوع ثابت** (مثلاً 1.00 ر.س على كل عملية).
     - **أو كلاهما معاً** (نسبة مئوية + مبلغ مقطوع).
   - إمكانية تطبيق نسبة ومبلغ عام على جميع المتاجر في المنصة.
   - إمكانية تخصيص نسبة ومبلغ مختلف ومستقل لكل متجر على حدة.
3. **محفظة مدير التطبيق واستخدام مبالغها:**
   - تتجمع فيها رسوم العمليات تلقائياً وفورياً.
   - خيارات استخدام مبالغ المحفظة:
     - **تسوية الرصيد واستلام قيمته من الحساب البنكي للمتجر** وإضافتها للحساب البنكي لمدير التطبيق.
     - **تحويل رصيد إلى نقاط البيع والوكلاء** مباشرة.
     - **شراء وبيع خدمات رقمية**.`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(masterPrompt);
    setCopiedPrompt(true);
    showToast({
      type: 'success',
      title: 'تم نسخ البرومت الشامل',
      description: 'البرومت المكتمل منسوخ للحافظة وجاهز للصق في أدوات الذكاء الاصطناعي أو تسليمه للمطورين.'
    });
    setTimeout(() => setCopiedPrompt(false), 3000);
  };

  const downloadPromptFile = () => {
    const blob = new Blob([masterPrompt], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'DigiPOS_Complete_Architecture_Prompt.md');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast({
      type: 'success',
      title: 'تم تنزيل ملف البرومت',
      description: 'تم تحميل ملف DigiPOS_Complete_Architecture_Prompt.md بنجاح.'
    });
  };

  return (
    <div className="space-y-6">
      
      {/* Studio Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-950 border border-amber-500/30 p-4 sm:p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white tracking-tight">
                  مركز ومحرر البرومت الهندسي الاحترافي
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  جاهز للنسخ والتنفيذ
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                صيغة برومت هندسية فائقة الدقة صممت خصيصاً لتوليد تطبيق الجوال المطلوب بكافة تفاصيله المحاسبية والتقنية.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={copyToClipboard}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors shadow-lg shadow-amber-500/20"
            >
              {copiedPrompt ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedPrompt ? 'تم النسخ بنجاح!' : 'نسخ البرومت كاملاً'}</span>
            </button>

            <button
              onClick={downloadPromptFile}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-4 h-4 text-amber-400" />
              <span>تحميل (.md)</span>
            </button>
          </div>
        </div>

        {/* Technology Customizer Strip */}
        <div className="mt-5 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="text-slate-400 font-medium">التقنية المستهدفة لتخصيص البرومت:</span>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setTargetTech('flutter')}
              className={`px-3 py-1 rounded-lg transition-colors font-medium ${
                targetTech === 'flutter'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              Flutter / Dart (تطبيق جوال أصيل)
            </button>
            <button
              onClick={() => setTargetTech('react_native')}
              className={`px-3 py-1 rounded-lg transition-colors font-medium ${
                targetTech === 'react_native'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              React Native / Expo
            </button>
            <button
              onClick={() => setTargetTech('kotlin')}
              className={`px-3 py-1 rounded-lg transition-colors font-medium ${
                targetTech === 'kotlin'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              Android Kotlin Compose
            </button>
            <button
              onClick={() => setTargetTech('react_web')}
              className={`px-3 py-1 rounded-lg transition-colors font-medium ${
                targetTech === 'react_web'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              React SPA + Tailwind
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-2 text-xs font-medium">
        <button
          onClick={() => setActiveTab('prompt')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
            activeTab === 'prompt'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
              : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
          }`}
        >
          <FileCode className="w-4 h-4 shrink-0" />
          <span>نص البرومت الشامل</span>
        </button>

        <button
          onClick={() => setActiveTab('tech_spec')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
            activeTab === 'tech_spec'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
              : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
          }`}
        >
          <Cpu className="w-4 h-4 shrink-0" />
          <span>المعادلات والضوابط</span>
        </button>

        <button
          onClick={() => setActiveTab('schema')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
            activeTab === 'schema'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
              : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
          }`}
        >
          <Database className="w-4 h-4 shrink-0" />
          <span>مخطط قواعد البيانات</span>
        </button>

        <button
          onClick={() => setActiveTab('ux_flows')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'ux_flows'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
              : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          <span>مخطط شاشات تجربة المستخدم (UX Flows)</span>
        </button>
      </div>

      {/* TAB 1: PROMPT TEXT */}
      {activeTab === 'prompt' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>نص البرومت المهيكل باللغة العربية وجاهز للنسخ المباشر:</span>
            <button
              onClick={copyToClipboard}
              className="text-amber-400 hover:underline flex items-center gap-1 font-semibold"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>نسخ كامل النص</span>
            </button>
          </div>

          <div className="p-4 sm:p-6 rounded-3xl bg-slate-900 border border-slate-800 font-mono text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-wrap select-all max-h-[600px] overflow-y-auto">
            {masterPrompt}
          </div>
        </div>
      )}

      {/* TAB 2: TECHNICAL SPECIFICATIONS & EQUATIONS */}
      {activeTab === 'tech_spec' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          
          <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
            <h3 className="font-bold text-sm text-amber-400 flex items-center gap-2">
              <span>1. صيغة المعرف الفريد لنقطة البيع (POS ID)</span>
            </h3>
            <p className="text-slate-300 leading-relaxed">
              وفق المواصفات المطلوبة: يتكون المعرف الرسمي لنقطة البيع من <strong>ثلاثة أحرف أبجدية كبيرة</strong> متبوعة بشرطة عادية <code className="bg-slate-950 px-1 py-0.5 rounded text-amber-300">-</code> ثم <strong>خمسة أرقام عشوائية</strong>.
            </p>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-center text-sm font-bold text-amber-400">
              Regex: /^[A-Z]{'{3}'}-[0-9]{'{5}'}$/ (مثال: RYD-10492)
            </div>
          </div>

          <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
            <h3 className="font-bold text-sm text-emerald-400 flex items-center gap-2">
              <span>2. معادلة اقتطاع رسوم التطبيق (Platform Commission)</span>
            </h3>
            <p className="text-slate-300 leading-relaxed">
              تكون النسبة الافتراضية 1% من قيمة الخدمة لكل المتاجر (مع إمكانية تعديلها لكل متجر). تضاف الرسوم فوق قيمة الخدمة أو تقتطع لحساب مدير التطبيق.
            </p>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-center text-xs space-y-1 text-slate-200">
              <div>FeeAmount = Round(UnitPrice × (FeePercentage / 100), 2)</div>
              <div className="text-emerald-400 font-bold">TotalDeducted = UnitPrice + FeeAmount</div>
            </div>
          </div>

          <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-3 md:col-span-2">
            <h3 className="font-bold text-sm text-purple-400 flex items-center gap-2">
              <span>3. مصفوفة تسعير الرتب الخمس (5-Tier Pricing Matrix)</span>
            </h3>
            <p className="text-slate-300 leading-relaxed">
              يتيح النظام للمتجر تحديد جدول أسعار منفصل لكل باقة في الخدمة، وتظهر تلقائياً لنقطة البيع بحسب رتبة حسابها:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block mb-1">عادي (Regular)</span>
                <span className="font-mono font-bold text-white text-base">100 ر.س</span>
                <span className="text-[10px] text-slate-500 block">السعر الأساسي</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-950 border border-amber-900/40">
                <span className="text-[10px] text-amber-500 block mb-1">نحاسي (Bronze)</span>
                <span className="font-mono font-bold text-amber-400 text-base">90 ر.س</span>
                <span className="text-[10px] text-slate-500 block">خصم 10%</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-700">
                <span className="text-[10px] text-slate-300 block mb-1">فضي (Silver)</span>
                <span className="font-mono font-bold text-slate-200 text-base">80 ر.س</span>
                <span className="text-[10px] text-slate-500 block">خصم 20%</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-950 border border-yellow-500/40">
                <span className="text-[10px] text-yellow-400 block mb-1">ذهبي (Gold)</span>
                <span className="font-mono font-bold text-yellow-300 text-base">70 ر.س</span>
                <span className="text-[10px] text-slate-500 block">خصم 30%</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-950 border border-purple-500/60 col-span-2 sm:col-span-1">
                <span className="text-[10px] text-purple-400 font-bold block mb-1">مميز (VIP)</span>
                <span className="font-mono font-bold text-purple-300 text-base">60 ر.س</span>
                <span className="text-[10px] text-emerald-400 block">أعلى توفير 40%</span>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* TAB 3: DATABASE SCHEMA */}
      {activeTab === 'schema' && (
        <div className="space-y-4">
          <div className="p-4 sm:p-6 rounded-3xl bg-slate-900 border border-slate-800 font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap select-all overflow-x-auto">
{`-- مخطط قواعد البيانات المقترح (PostgreSQL / Relational or Firestore Collections):

-- 1. جدول المتاجر (Suppliers)
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    store_name VARCHAR(200) NOT NULL,
    phone VARCHAR(25) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    fee_percentage NUMERIC(5,2) DEFAULT 1.00, -- نسبة رسوم المنصة
    wallet_balance NUMERIC(14,2) DEFAULT 0.00,
    bank_name VARCHAR(100),
    bank_iban VARCHAR(40),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. جدول نقاط البيع والوكلاء (POS Clients)
CREATE TABLE pos_clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
    pos_code VARCHAR(15) UNIQUE NOT NULL, -- e.g. 'RYD-10492'
    trade_name VARCHAR(200) NOT NULL,
    owner_name VARCHAR(150) NOT NULL,
    phone VARCHAR(25) NOT NULL,
    country VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL,
    tier VARCHAR(20) DEFAULT 'regular', -- 'regular', 'bronze', 'silver', 'gold', 'vip'
    wallet_balance NUMERIC(14,2) DEFAULT 0.00,
    qr_code_payload TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. جدول الكتالوجات (Catalogs)
CREATE TABLE catalogs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID REFERENCES suppliers(id),
    name_ar VARCHAR(150) NOT NULL,
    description_ar TEXT,
    icon VARCHAR(50)
);

-- 4. جدول الخدمات الرقمية (Digital Services)
CREATE TABLE digital_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    catalog_id UUID REFERENCES catalogs(id),
    supplier_id UUID REFERENCES suppliers(id),
    name_ar VARCHAR(200) NOT NULL,
    description_ar TEXT,
    delivery_methods JSONB NOT NULL, -- ['player_id', 'account_login', 'voucher_code']
    is_active BOOLEAN DEFAULT TRUE
);

-- 5. جدول الباقات والتسعير الطبقي (Packages & Tier Prices)
CREATE TABLE service_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID REFERENCES digital_services(id) ON DELETE CASCADE,
    package_name VARCHAR(150) NOT NULL,
    price_regular NUMERIC(10,2) NOT NULL, -- 100 SAR
    price_bronze NUMERIC(10,2) NOT NULL,  -- 90 SAR
    price_silver NUMERIC(10,2) NOT NULL,  -- 80 SAR
    price_gold NUMERIC(10,2) NOT NULL,    -- 70 SAR
    price_vip NUMERIC(10,2) NOT NULL,     -- 60 SAR
    stock_count INT DEFAULT 0
);

-- 6. جدول طلبات شحن الرصيد المسبق (Deposit Requests)
CREATE TABLE deposit_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pos_id UUID REFERENCES pos_clients(id),
    supplier_id UUID REFERENCES suppliers(id),
    amount NUMERIC(12,2) NOT NULL,
    transfer_number VARCHAR(100) NOT NULL, -- رقم الحوالة
    transfer_sender_name VARCHAR(150) NOT NULL, -- اسم المحول
    bank_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    approved_at TIMESTAMP WITH TIME ZONE
);

-- 7. جدول العمليات والشحنات (Orders)
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pos_id UUID REFERENCES pos_clients(id),
    supplier_id UUID REFERENCES suppliers(id),
    service_id UUID REFERENCES digital_services(id),
    package_id UUID REFERENCES service_packages(id),
    delivery_method VARCHAR(30) NOT NULL,
    delivery_details JSONB NOT NULL,
    cost_price NUMERIC(10,2) NOT NULL,
    fee_amount NUMERIC(10,2) NOT NULL,
    total_deducted NUMERIC(10,2) NOT NULL,
    payment_method VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'completed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. القيود المحاسبية وكشف الحساب (Accounting Ledgers)
CREATE TABLE accounting_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pos_id UUID REFERENCES pos_clients(id),
    supplier_id UUID REFERENCES suppliers(id),
    entry_type VARCHAR(30) NOT NULL, -- 'purchase', 'sale', 'deposit', 'transfer_out', 'transfer_in', 'fee'
    reference_id VARCHAR(100),
    description TEXT NOT NULL,
    debit NUMERIC(12,2) DEFAULT 0.00,
    credit NUMERIC(12,2) DEFAULT 0.00,
    balance_after NUMERIC(14,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`}
          </div>
        </div>
      )}

      {/* TAB 4: UX FLOWS */}
      {activeTab === 'ux_flows' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          
          <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold">1</div>
            <h4 className="font-bold text-white text-sm">تدفق التسليم عبر الأيدي</h4>
            <ol className="list-decimal list-inside space-y-1 text-slate-300">
              <li>اختيار طريقة "فوري عبر الأيدي".</li>
              <li>إدخال معرف اللاعب (Player ID).</li>
              <li>الضغط على "تحقق من الأيدي" لجلب الاسم.</li>
              <li>اختيار الباقة (تظهر أسعار رتبة العميل).</li>
              <li>تأكيد الدفع (محفظة أو فيزا).</li>
              <li>رسالة "العملية قيد الإنجاز" ثم "تمت بنجاح".</li>
            </ol>
          </div>

          <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center font-bold">2</div>
            <h4 className="font-bold text-white text-sm">تدفق التسليم عبر الحساب و 2FA</h4>
            <ol className="list-decimal list-inside space-y-1 text-slate-300">
              <li>اختيار طريقة "فوري عبر الحساب".</li>
              <li>إدخال الإيميل وكلمة المرور وإرسالها.</li>
              <li>ظهور حقل رمز التحقق (OTP) من إشعارات البريد.</li>
              <li>فحص صحة الرمز: ظهور تنبيه نجاح أو خطأ.</li>
              <li>تأكيد الشحن فور اكتمال التوثيق.</li>
            </ol>
          </div>

          <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold">3</div>
            <h4 className="font-bold text-white text-sm">تدفق روابط الدعوة بالرتبة المحددة</h4>
            <ol className="list-decimal list-inside space-y-1 text-slate-300">
              <li>يقوم المتجر باختيار الرتبة (مثلاً مميز VIP).</li>
              <li>توليد رابط فريد ومشاركته مع العميل.</li>
              <li>تسجيل العميل عبر الرابط وتعبئة بيانات محله.</li>
              <li>إنشاء حسابه تلقائياً برتبة مميز كما حددها المتجر.</li>
              <li>ظهور تسعيرات الـ 60 ر.س في متجره فوراً.</li>
            </ol>
          </div>

        </div>
      )}

    </div>
  );
};
