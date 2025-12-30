import React, { useState } from 'react';
import { useWorld } from '../context/WorldContext';
import { I18N } from '../constants';
import { Download, Upload, Globe, Check } from 'lucide-react';

const Settings = () => {
  const { language, setLanguage, exportData, importData } = useWorld();
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleExport = () => {
    const jsonString = exportData();
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `aetheria_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const success = importData(content);
      setImportStatus(success ? 'success' : 'error');
      setTimeout(() => setImportStatus('idle'), 3000);
    };
    reader.readAsText(file);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto animate-in fade-in duration-500">
      <h1 className="text-3xl font-light text-gray-900 mb-8">{I18N.settings[language]}</h1>

      {/* Language */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          <Globe className="w-5 h-5 mr-2 text-gray-500" />
          {I18N.language[language]}
        </h2>
        <div className="flex space-x-4">
          <button 
            onClick={() => setLanguage('zh')}
            className={`px-6 py-3 rounded-xl border flex items-center transition-all ${language === 'zh' ? 'border-primary-500 bg-primary-50 text-primary-700 font-medium' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
          >
            中文 (Chinese)
            {language === 'zh' && <Check className="w-4 h-4 ml-2" />}
          </button>
          <button 
             onClick={() => setLanguage('en')}
             className={`px-6 py-3 rounded-xl border flex items-center transition-all ${language === 'en' ? 'border-primary-500 bg-primary-50 text-primary-700 font-medium' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
          >
            English
            {language === 'en' && <Check className="w-4 h-4 ml-2" />}
          </button>
        </div>
      </section>

      {/* Data Management */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
           {I18N.data_management[language]}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Export */}
          <div className="p-6 rounded-xl bg-gray-50 border border-gray-100">
             <h3 className="font-medium text-gray-900 mb-2">{I18N.export_data[language]}</h3>
             <p className="text-sm text-gray-500 mb-4">{I18N.backup_desc[language]}</p>
             <button 
                onClick={handleExport}
                className="w-full py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex justify-center items-center shadow-sm"
             >
               <Download className="w-4 h-4 mr-2" />
               {I18N.download_backup[language]}
             </button>
          </div>

          {/* Import */}
          <div className="p-6 rounded-xl bg-gray-50 border border-gray-100">
             <h3 className="font-medium text-gray-900 mb-2">{I18N.import_data[language]}</h3>
             <p className="text-sm text-gray-500 mb-4">{I18N.restore_desc[language]}</p>
             <div className="relative">
                <input 
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <button 
                   className={`w-full py-2 border rounded-lg transition-colors flex justify-center items-center shadow-sm ${
                     importStatus === 'success' ? 'bg-green-50 border-green-200 text-green-700' :
                     importStatus === 'error' ? 'bg-red-50 border-red-200 text-red-700' :
                     'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                   }`}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {importStatus === 'success' ? I18N.import_success[language] : 
                   importStatus === 'error' ? I18N.import_error[language] : 
                   I18N.select_file[language]}
                </button>
             </div>
          </div>

        </div>
      </section>
    </div>
  );
};

export default Settings;
