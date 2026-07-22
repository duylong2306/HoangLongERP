import React, { useState, useEffect } from 'react';
import { dbService } from '../lib/dbService';
import { Save, RefreshCw, FileText, Settings, UserCheck, Shield, HelpCircle, CheckCircle } from 'lucide-react';

export default function DocumentTemplatesEditor() {
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Internal tab state: 'common' | 'quote' | 'contract' | 'acceptance' | 'liquidation'
  const [activeSubTab, setActiveSubTab] = useState<'common' | 'quote' | 'contract' | 'acceptance' | 'liquidation'>('common');

  // State values mapping directly to our template requirements
  const [template, setTemplate] = useState({
    // Common settings
    companyName: 'Công ty TNHH Hoàng Long Lâm Đồng',
    brandLabel: 'HOANG LONG',
    brandSublabel: 'Construction - Furniture - Doors',
    companyPhone: '0966 545 959 - 0374 883 979',
    companyEmail: 'hoanglongld.com@gmail.com',
    companyWebsite: 'hoanglongld.com',
    bizLocation: 'Số 4 TDP Trung Vương, TT. Nam Ban, huyện Lâm Hà, tỉnh Lâm Đồng',
    companyAddress: '54/20 Kim Đồng, Phường 6, TP. Đà Lạt, tỉnh Lâm Đồng',
    companyTaxCode: '5801372263',
    bankName: 'Ngân hàng TMCP Quân Đội (MB BANK)',
    bankAccountNo: '799201899999',
    bankAccountName: 'Công ty TNHH Hoàng Long Lâm Đồng',
    signingRep: 'Ông Trương Hữu Long',
    repRole: 'Giám đốc',

    // Báo giá
    quoteTitle: 'BẢNG BÁO GIÁ GIÁ NỘI THẤT CHI TIẾT',
    quoteGreetingRow1: 'Trước hết, chúng tôi xin chân thành cảm ơn sự tin tưởng và hợp tác của quý khách hàng đối với Nội Thất Hoàng Long.',
    quoteGreetingRow2: 'Theo yêu cầu tư vấn và thiết kế của quý khách hàng, chúng tôi trân trọng gửi bảng báo giá thi công nội thất chi tiết như sau:',
    termsExecutionTime: '10-15 ngày kể từ ngày duyệt thiết kế 3D hoàn chỉnh.',
    termsWarranty: 'Mộc Nội Thất được bảo hành 01 năm đối với lỗi sản xuất; các linh phụ kiện lỗi đổi mới hoàn toàn.',
    termsDisclaimer: 'Đơn giá trên áp dụng theo đúng thiết kế và vật liệu đã chỉ định. Mọi chỉnh sửa thay đổi khác biệt trong quá trình thi công thực tế do quý khách yêu cầu sẽ được hai bên ghi nhận điều chỉnh phát sinh tăng hoặc giảm bằng văn bản.',

    // Hợp đồng
    contractTitle: 'HỢP ĐỒNG THI CÔNG NỘI THẤT',
    contractDurationDays: '15',
    article1_1: 'Bên A giao cho Bên B thầu thi công sản phẩm nội thất theo đúng bản vẽ kiến trúc, kết cấu nội thất đã được hai bên thống nhất và ký xác nhận kèm theo phụ lục của hợp đồng này.',
    article1_2: 'Bên B sử dụng toàn bộ vật tư, chất liệu gỗ công nghiệp, mã số màu sơn hoặc phủ Melamine theo đúng thông số kỹ thuật thể hiện chi tiết tại nội dung báo giá.',
    article5: '- Bản vẽ nghiệm thu công trình được sử dụng làm căn cứ kỹ thuật bàn giao thực phẩm nội thất.\n- Chính sách bảo hành: Bên B cam kết thực hiện bảo hành toàn diện sản phẩm nội thất cung cấp trong thời gian 12 tháng đối với các lỗi kỹ thuật phát sinh từ khâu sản xuất hoặc lắp đặt cấu kiện.',

    // Nghiệm thu
    acceptanceTitle: 'BIÊN BẢN NGHIỆM THU VÀ BÀN GIAO',
    acceptanceSubtitle: '(Sử dụng để bàn giao chuyển tải đưa công trình vào sử dụng)',
    workName: 'Nội thất lắp đặt hoàn thiện',
    subWorkName: 'Hạng mục nội thất chi tiết',
    acceptanceCriteria: 'Toàn bộ các cấu kiện do Bên B lắp ráp tại vị trí công trình mới 100%, bảo hành chuẩn hãng, đúng chất liệu gỗ công nghiệp chịu nhiệt chuẩn xưởng như cam kết.',
    acceptanceSpeed: 'Bên B hoàn thiện lắp ráp bàn ráp đúng khuôn mẫu kỹ thuật tiến độ, đã hỗ trợ hướng dẫn Bên A các thông tin nội thất liên quan.',
    acceptanceConclusion: 'Hai bên nhất trí đồng ý ký kết nghiệm thu công trình thầu thầu bàn giao chính thức để chủ đầu tư bắt đầu đưa vào vận hành sử dụng.',

    // Thanh lý
    liquidationTitle: 'BIÊN BẢN THANH LÝ HỢP ĐỒNG KHÁCH HÀNG',
    liquidationSubtitle: '(Hai bên hoàn thành trách nhiệm bàn giao thanh lý tất cả các nghĩa vụ thầu)',
    liquidationClause1: 'Bên B đã thực hiện cung cấp thiết kế, triển khai lắp ráp hoàn thiện đầy đủ số lượng và chất lượng các sản phẩm nội thất tại công trình theo đúng yêu cầu chi tiết thể hiện ở biên bản nghiệm thu trước ngày [ngay_nghiem_thu].',
    liquidationClause2: 'Bên A đã hoàn tất kiểm kê, xác nhận đạt tiêu chuẩn mỹ thuật và đồng ý ký nghiệm thu thanh lý tất cả trạng thái liên quan của Hợp đồng thầu được ký kết.',
    liquidationAgreement: 'Sau khi hoàn tất chuyển giao tiền mặt hoặc tất toán tài chính trên, hai bên đồng ý tuyên bố hợp đồng chính thức được thanh lý, không còn bất kỳ tranh chấp công trình nào phát sinh sau này.'
  });

  // Load existing configuration từ Supabase (quotation_configs.interior)
  useEffect(() => {
    const fetchTemplateConfig = async () => {
      setLoading(true);
      try {
        const stored = await dbService.quotationConfigs.get('interior');
        if (stored && typeof stored === 'object' && Object.keys(stored).length > 0) {
          setTemplate(prev => ({
            ...prev,
            ...stored
          }));
        }
      } catch (e) {
        console.error("Lỗi khi đồng bộ mẫu hồ sơ từ Supabase:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchTemplateConfig();
  }, []);

  const handleFieldChange = (key: string, value: string) => {
    setTemplate(prev => ({
      ...prev,
      [key]: value
    }));
    if (saveStatus !== 'idle') {
      setSaveStatus('idle');
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    setSaveStatus('idle');
    try {
      await dbService.quotationConfigs.save('interior', template);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (e) {
      console.error(e);
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-xs text-slate-500 animate-pulse font-bold uppercase tracking-widest bg-slate-900/10 rounded-xl border border-slate-800">
        Đang đồng bộ cấu trúc mẫu hồ sơ thông minh...
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans text-slate-200" id="document_templates_workspace">
      
      {/* Visual Tab Bar Selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800 shadow-inner">
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setActiveSubTab('common')}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${activeSubTab === 'common' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white bg-slate-950/40'}`}
          >
            <Settings className="w-3.5 h-3.5" />
            Thông Tin Chung (Bên B)
          </button>
          
          <button
            type="button"
            onClick={() => setActiveSubTab('quote')}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${activeSubTab === 'quote' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white bg-slate-950/40'}`}
          >
            <FileText className="w-3.5 h-3.5 text-amber-400" />
            Mẫu Báo Giá
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('contract')}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${activeSubTab === 'contract' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white bg-slate-950/40'}`}
          >
            <FileText className="w-3.5 h-3.5 text-indigo-400" />
            Mẫu Hợp Đồng
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('acceptance')}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${activeSubTab === 'acceptance' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white bg-slate-950/40'}`}
          >
            <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
            Mẫu Nghiệm Thu
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('liquidation')}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${activeSubTab === 'liquidation' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white bg-slate-950/40'}`}
          >
            <Shield className="w-3.5 h-3.5 text-rose-400" />
            Mẫu Thanh Lý
          </button>
        </div>

        {/* Master save actions */}
        <button
          type="button"
          onClick={saveConfig}
          disabled={saving}
          className={`px-4.5 py-2 text-white font-extrabold text-xs rounded-xl cursor-pointer flex items-center gap-2 shadow-md transition-all shrink-0 hover:scale-[1.01] ${saveStatus === 'success' ? 'bg-[#00a651]' : saveStatus === 'error' ? 'bg-rose-600' : 'bg-emerald-600 hover:bg-[#008f45]'}`}
        >
          {saving ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          {saveStatus === 'success' ? 'Đã Lưu Thành Công!' : saveStatus === 'error' ? 'Có Lỗi Xảy Ra' : 'Lưu Mẫu Thiết Kế'}
        </button>
      </div>

      {/* Editor Panels Container */}
      <div className="bg-slate-900/20 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5">
        
        {/* PANEL 1: COMMON INFO */}
        {activeSubTab === 'common' && (
          <div className="space-y-4">
            <div className="border-b border-slate-800 pb-2 mb-3">
              <h4 className="font-extrabold text-xs text-slate-300 uppercase tracking-widest text-[#00a651]">
                Cấu hình thông tin pháp lý & liên hệ của nhà thầu (Bên B)
              </h4>
              <p className="text-[10px] text-slate-500 mt-1">Các dữ liệu sau tự động ánh xạ đồng bộ sang tất cả hồ sơ: Báo giá, Hợp đồng, Nghiệm thu, và Thanh lý.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[10.5px] font-bold text-slate-400">Tên Doanh Nghiệp (Pháp lý):</label>
                <input
                  type="text"
                  value={template.companyName}
                  onChange={(e) => handleFieldChange('companyName', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-[#00a651] outline-none rounded-lg px-3.5 py-2 text-xs font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10.5px] font-bold text-slate-400">Tên thương hiệu dạng ngắn:</label>
                <input
                  type="text"
                  value={template.brandLabel}
                  onChange={(e) => handleFieldChange('brandLabel', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-[#00a651] outline-none rounded-lg px-3.5 py-2 text-xs font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10.5px] font-bold text-slate-400 font-mono">Slogan/Brand Sublabel:</label>
                <input
                  type="text"
                  value={template.brandSublabel}
                  onChange={(e) => handleFieldChange('brandSublabel', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-[#00a651] outline-none rounded-lg px-3.5 py-2 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10.5px] font-bold text-slate-400">Mã Số Thuế:</label>
                <input
                  type="text"
                  value={template.companyTaxCode}
                  onChange={(e) => handleFieldChange('companyTaxCode', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-[#00a651] outline-none rounded-lg px-3.5 py-2 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10.5px] font-bold text-slate-400">Hotline liên hệ:</label>
                <input
                  type="text"
                  value={template.companyPhone}
                  onChange={(e) => handleFieldChange('companyPhone', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-[#00a651] outline-none rounded-lg px-3.5 py-2 text-xs font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10.5px] font-bold text-slate-400">Email giao dịch:</label>
                <input
                  type="text"
                  value={template.companyEmail}
                  onChange={(e) => handleFieldChange('companyEmail', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-[#00a651] outline-none rounded-lg px-3.5 py-2 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10.5px] font-bold text-slate-400">Website:</label>
                <input
                  type="text"
                  value={template.companyWebsite}
                  onChange={(e) => handleFieldChange('companyWebsite', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-[#00a651] outline-none rounded-lg px-3.5 py-2 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10.5px] font-bold text-slate-400">Đại diện ký nhận (Bên B):</label>
                <input
                  type="text"
                  value={template.signingRep}
                  onChange={(e) => handleFieldChange('signingRep', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-[#00a651] outline-none rounded-lg px-3.5 py-2 text-xs font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10.5px] font-bold text-slate-400">Chức vụ đại điện:</label>
                <input
                  type="text"
                  value={template.repRole}
                  onChange={(e) => handleFieldChange('repRole', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-[#00a651] outline-none rounded-lg px-3.5 py-2 text-xs font-medium"
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="block text-[10.5px] font-bold text-slate-400">Trụ sở pháp lý (Đà Lạt):</label>
                <input
                  type="text"
                  value={template.companyAddress}
                  onChange={(e) => handleFieldChange('companyAddress', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-[#00a651] outline-none rounded-lg px-3.5 py-2 text-xs"
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="block text-[10.5px] font-bold text-slate-400">Địa chỉ văn phòng giao dịch thầu (Lâm Hà):</label>
                <input
                  type="text"
                  value={template.bizLocation}
                  onChange={(e) => handleFieldChange('bizLocation', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-[#00a651] outline-none rounded-lg px-3.5 py-2 text-xs"
                />
              </div>
            </div>

            <div className="border-t border-slate-800/60 pt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="block text-[10.5px] font-bold text-slate-400">Tên ngân hàng tài khoản chính:</label>
                <input
                  type="text"
                  value={template.bankName}
                  onChange={(e) => handleFieldChange('bankName', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-[#00a651] outline-none rounded-lg px-3.5 py-2 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10.5px] font-bold text-slate-400">Số tài khoản chuyển khoản:</label>
                <input
                  type="text"
                  value={template.bankAccountNo}
                  onChange={(e) => handleFieldChange('bankAccountNo', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-[#00a651] outline-none rounded-lg px-3.5 py-2 text-xs font-mono font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10.5px] font-bold text-slate-400">Tên chủ tài khoản chính:</label>
                <input
                  type="text"
                  value={template.bankAccountName}
                  onChange={(e) => handleFieldChange('bankAccountName', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-[#00a651] outline-none rounded-lg px-3.5 py-2 text-xs uppercase"
                />
              </div>
            </div>
          </div>
        )}

        {/* PANEL 2: BÁO GIÁ EDIT */}
        {activeSubTab === 'quote' && (
          <div className="space-y-4">
            <div className="border-b border-slate-800 pb-2 mb-3">
              <h4 className="font-extrabold text-xs text-slate-300 uppercase tracking-widest text-[#00a651]">
                Cài đặt chi tiết văn bản Báo Giá
              </h4>
              <p className="text-[10px] text-slate-500 mt-1">Các đoạn văn chào hỏi, lời giới thiệu và điều khoản cam kết mộc thầu.</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="block text-[10.5px] font-bold text-slate-400">Tiêu đề Báo Giá (In Hoa):</label>
                <input
                  type="text"
                  value={template.quoteTitle}
                  onChange={(e) => handleFieldChange('quoteTitle', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-[#00a651] outline-none rounded-lg px-3.5 py-2 text-xs font-bold text-white uppercase"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10.5px] font-bold text-slate-400">Lời Chào Lập Đầu (Dòng 1):</label>
                <textarea
                  rows={2}
                  value={template.quoteGreetingRow1}
                  onChange={(e) => handleFieldChange('quoteGreetingRow1', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-[#00a651] outline-none rounded-lg px-3.5 py-2 text-xs resize-y"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10.5px] font-bold text-slate-400">Lời Dẫn Gửi Báo Giá (Dòng 2):</label>
                <textarea
                  rows={2}
                  value={template.quoteGreetingRow2}
                  onChange={(e) => handleFieldChange('quoteGreetingRow2', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-[#00a651] outline-none rounded-lg px-3.5 py-2 text-xs resize-y"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-800 pt-3">
                <div className="space-y-1">
                  <label className="block text-[10.5px] font-bold text-slate-400">Thời gian thực hiện mặc định:</label>
                  <input
                    type="text"
                    value={template.termsExecutionTime}
                    onChange={(e) => handleFieldChange('termsExecutionTime', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-[#00a651] outline-none rounded-lg px-3.5 py-2 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10.5px] font-bold text-slate-400">Chính sách bảo hành thầu:</label>
                  <input
                    type="text"
                    value={template.termsWarranty}
                    onChange={(e) => handleFieldChange('termsWarranty', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-[#00a651] outline-none rounded-lg px-3.5 py-2 text-xs text-slate-300"
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="block text-[10.5px] font-bold text-slate-400">Mục lục Lưu Ý Khách Hàng (Tuyên Bố):</label>
                  <textarea
                    rows={3}
                    value={template.termsDisclaimer}
                    onChange={(e) => handleFieldChange('termsDisclaimer', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-[#00a651] outline-none rounded-lg px-3.5 py-2 text-xs resize-y"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PANEL 3: HỢP ĐỒNG EDIT */}
        {activeSubTab === 'contract' && (
          <div className="space-y-4">
            <div className="border-b border-slate-800 pb-2 mb-3">
              <h4 className="font-extrabold text-xs text-slate-300 uppercase tracking-widest text-[#00a651]">
                Cấu hình các điều khoản Hợp Đồng thi công
              </h4>
              <p className="text-[10px] text-slate-500 mt-1">Điều chỉnh các cơ sở pháp lý, số ngày bàn giao thầu và chính sách kiểm định gỗ xưởng.</p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-3 space-y-1">
                  <label className="block text-[10.5px] font-bold text-slate-400">Tiêu đề hợp đồng (In Hoa):</label>
                  <input
                    type="text"
                    value={template.contractTitle}
                    onChange={(e) => handleFieldChange('contractTitle', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-[#00a651] outline-none rounded-lg px-3.5 py-2 text-xs font-bold text-white uppercase"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10.5px] font-bold text-slate-400">Số ngày thi công hoàn thiện:</label>
                  <input
                    type="text"
                    value={template.contractDurationDays}
                    onChange={(e) => handleFieldChange('contractDurationDays', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-[#00a651] outline-none rounded-lg px-3.5 py-2 text-xs font-mono font-bold text-emerald-400 text-center"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10.5px] font-bold text-slate-400">Điều 1.1: Khối lượng công việc thi công thầu:</label>
                <textarea
                  rows={2}
                  value={template.article1_1}
                  onChange={(e) => handleFieldChange('article1_1', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-[#00a651] outline-none rounded-lg px-3.5 py-2 text-xs resize-y"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10.5px] font-bold text-slate-400">Điều 1.2: Sử dụng chất liệu, xuất xứ vật tư:</label>
                <textarea
                  rows={2}
                  value={template.article1_2}
                  onChange={(e) => handleFieldChange('article1_2', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-[#00a651] outline-none rounded-lg px-3.5 py-2 text-xs resize-y"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10.5px] font-bold text-slate-400">Điều 5: Định nghĩa điều khoản nghiệm thu và bảo hành 12 tháng:</label>
                <textarea
                  rows={3}
                  value={template.article5}
                  onChange={(e) => handleFieldChange('article5', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-[#00a651] outline-none rounded-lg px-3.5 py-2 text-xs font-mono text-cyan-200 resize-y"
                />
              </div>
            </div>
          </div>
        )}

        {/* PANEL 4: NGHIỆM THU EDIT */}
        {activeSubTab === 'acceptance' && (
          <div className="space-y-4">
            <div className="border-b border-slate-800 pb-2 mb-3">
              <h4 className="font-extrabold text-xs text-slate-300 uppercase tracking-widest text-[#00a651]">
                Thiết lập Mẫu Biên Bản Nghiệm Thu & Bàn Giao
              </h4>
              <p className="text-[10px] text-slate-500 mt-1">Cấu hình tiêu chuẩn chất lượng gỗ tháo dỡ, tốc độ lắp ráp, và các kết luận pháp lý bàn giao.</p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10.5px] font-bold text-slate-400">Tiêu đề Biên Bản (In Hoa):</label>
                  <input
                    type="text"
                    value={template.acceptanceTitle}
                    onChange={(e) => handleFieldChange('acceptanceTitle', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-[#00a651] outline-none rounded-lg px-3.5 py-2 text-xs font-bold text-white uppercase"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10.5px] font-bold text-slate-400">Tiêu đề phụ giải nghĩa:</label>
                  <input
                    type="text"
                    value={template.acceptanceSubtitle}
                    onChange={(e) => handleFieldChange('acceptanceSubtitle', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-[#00a651] outline-none rounded-lg px-3.5 py-2 text-xs text-slate-400 italic"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10.5px] font-bold text-slate-400">Tên công trình đại diện:</label>
                  <input
                    type="text"
                    value={template.workName}
                    onChange={(e) => handleFieldChange('workName', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-[#00a651] outline-none rounded-lg px-3.5 py-2 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10.5px] font-bold text-slate-400">Tên hạng mục mặc định:</label>
                  <input
                    type="text"
                    value={template.subWorkName}
                    onChange={(e) => handleFieldChange('subWorkName', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-[#00a651] outline-none rounded-lg px-3.5 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10.5px] font-bold text-slate-400">Tiêu chuẩn chất lượng vật tư mới 100%:</label>
                <textarea
                  rows={2}
                  value={template.acceptanceCriteria}
                  onChange={(e) => handleFieldChange('acceptanceCriteria', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-[#00a651] outline-none rounded-lg px-3.5 py-2 text-xs resize-y"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10.5px] font-bold text-slate-400">Tiêu chuẩn kỹ thuật tiến độ, hướng dẫn sử dụng:</label>
                <textarea
                  rows={2}
                  value={template.acceptanceSpeed}
                  onChange={(e) => handleFieldChange('acceptanceSpeed', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-[#00a651] outline-none rounded-lg px-3.5 py-2 text-xs resize-y"
                />
              </div>

              <div className="space-y-1 border-t border-slate-800/60 pt-3">
                <label className="block text-[10.5px] font-bold text-slate-400">Kết Luận Nghiệm Thu đưa công trình vào vận hành:</label>
                <textarea
                  rows={2}
                  value={template.acceptanceConclusion}
                  onChange={(e) => handleFieldChange('acceptanceConclusion', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-[#00a651] outline-none rounded-lg px-3.5 py-2 text-xs font-semibold text-emerald-400 resize-y"
                />
              </div>
            </div>
          </div>
        )}

        {/* PANEL 5: THANH LÝ EDIT */}
        {activeSubTab === 'liquidation' && (
          <div className="space-y-4">
            <div className="border-b border-slate-800 pb-2 mb-3">
              <h4 className="font-extrabold text-xs text-slate-300 uppercase tracking-widest text-[#00a651]">
                Chỉnh sửa Mẫu Biên Bản Thanh Lý Hợp Đồng thầu
              </h4>
              <p className="text-[10px] text-slate-500 mt-1">Sửa đổi căn bản các tuyên bố chấm dứt nghĩa vụ, quyền lợi và miễn trừ tranh chấp.</p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10.5px] font-bold text-slate-400">Tiêu đề Thanh Lý (In Hoa):</label>
                  <input
                    type="text"
                    value={template.liquidationTitle}
                    onChange={(e) => handleFieldChange('liquidationTitle', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-[#00a651] outline-none rounded-lg px-3.5 py-2 text-xs font-bold text-white uppercase"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10.5px] font-bold text-slate-400">Tiêu đề phụ giải nghĩa:</label>
                  <input
                    type="text"
                    value={template.liquidationSubtitle}
                    onChange={(e) => handleFieldChange('liquidationSubtitle', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-[#00a651] outline-none rounded-lg px-3.5 py-2 text-xs text-slate-400 italic"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10.5px] font-bold text-slate-400">Khoản 1: Chất lượng công trình nghiệm thu đúng tiến độ:</label>
                <textarea
                  rows={2}
                  value={template.liquidationClause1}
                  onChange={(e) => handleFieldChange('liquidationClause1', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-[#00a651] outline-none rounded-lg px-3.5 py-2 text-xs resize-y"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10.5px] font-bold text-slate-400">Khoản 2: Sự nhất trí của khách hàng về tiêu chuẩn mỹ thuật:</label>
                <textarea
                  rows={2}
                  value={template.liquidationClause2}
                  onChange={(e) => handleFieldChange('liquidationClause2', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-[#00a651] outline-none rounded-lg px-3.5 py-2 text-xs resize-y"
                />
              </div>

              <div className="space-y-1 border-t border-slate-800/60 pt-3">
                <label className="block text-[10.5px] font-bold text-slate-400">Tuyên bố cam kết chung và thanh toán dứt điểm:</label>
                <textarea
                  rows={2}
                  value={template.liquidationAgreement}
                  onChange={(e) => handleFieldChange('liquidationAgreement', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-[#00a651] outline-none rounded-lg px-3.5 py-2 text-xs font-semibold text-rose-450 resize-y"
                />
              </div>
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
