import { Browser } from '@capacitor/browser';
import { Filesystem, Directory } from '@capacitor/filesystem';

/**
 * savePDF - Smart PDF saver that works in both Electron and browser.
 *
 * In Electron: saves directly to the Downloads folder with no dialog.
 * In browser: triggers normal browser download.
 *
 * @param {jsPDF} doc - The jsPDF document instance
 * @param {string} filename - The desired filename (e.g., 'Report_2026-06-09.pdf')
 * @param {Object} options - Additional options (e.g., { returnUrl: boolean })
 */
export const savePDF = async (doc, filename, options = {}) => {
  // Check if running inside Electron
  if (window.electronAPI?.isElectron) {
    try {
      // Prompt user with confirmation dialog (with OK and Cancel buttons)
      const confirmSave = window.confirmDialog
        ? await window.confirmDialog(`Do you want to save this PDF to Downloads?\nFile Name: ${filename}`, 'Download', 'Cancel')
        : window.confirm(`Do you want to save this PDF to Downloads?\nFile Name: ${filename}`);

      if (!confirmSave) {
        return; // User cancelled, do not save
      }

      // Get PDF as base64 string (no dialog, no blob URL)
      const base64 = doc.output('datauristring').split(',')[1];
      const result = await window.electronAPI.savePDF(filename, base64);

      if (result?.success) {
        // Show a brief success toast/alert
        alert(`✅ PDF saved to Downloads:\n${result.filePath}`);
      } else {
        throw new Error(result?.error || 'Unknown error');
      }
    } catch (err) {
      console.error('Electron PDF save error:', err);
      // Fallback to normal save
      doc.save(filename);
    }
  } else if (window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform() !== 'web') {
    // Capacitor (Android/iOS Tablet/Mobile)
    try {
      const confirmSave = window.confirmDialog
        ? await window.confirmDialog(`Do you want to download this PDF?\nFile Name: ${filename}`, 'Download', 'Cancel')
        : window.confirm(`Do you want to download this PDF?\nFile Name: ${filename}`);

      if (!confirmSave) {
        return null;
      }

      const base64 = doc.output('datauristring').split(',')[1];
      
      try {
        const permResult = await Filesystem.checkPermissions();
        if (permResult.publicStorage !== 'granted') {
          await Filesystem.requestPermissions();
        }
      } catch (permErr) {
        console.warn('Filesystem permissions check failed, writing anyway...', permErr);
      }

      const writeResult = await Filesystem.writeFile({
        path: filename,
        data: base64,
        directory: Directory.Documents,
        recursive: true
      });

      alert(`✅ PDF saved to Documents folder:\n${filename}`);
      return writeResult.uri;
    } catch (err) {
      console.error('Capacitor PDF download error:', err);
      alert('Failed to download PDF on mobile: ' + err.message);
      return null;
    }
  } else {
    // Normal web browser download
    doc.save(filename);
  }
};

