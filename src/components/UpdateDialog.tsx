import { useState } from "react";
import { Download, X, RefreshCw, AlertCircle } from "lucide-react";
import { useUpdate } from "../contexts/UpdateContext";
import { relaunchApp } from "../lib/updater";

interface UpdateDialogProps {
  open: boolean;
  onClose: () => void;
}

export function UpdateDialog({ open, onClose }: UpdateDialogProps) {
  const { updateInfo, updateHandle, dismissUpdate } = useUpdate();
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  if (!open || !updateInfo || !updateHandle) {
    return null;
  }

  const handleDownloadAndInstall = async () => {
    setIsDownloading(true);
    setError(null);
    setDownloadProgress(0);

    try {
      let totalBytes = 0;
      let downloadedBytes = 0;

      await updateHandle.downloadAndInstall((event) => {
        if (event.event === "Started") {
          totalBytes = event.total || 0;
          downloadedBytes = 0;
        } else if (event.event === "Progress") {
          downloadedBytes += event.downloaded || 0;
          if (totalBytes > 0) {
            setDownloadProgress(Math.round((downloadedBytes / totalBytes) * 100));
          }
        } else if (event.event === "Finished") {
          setDownloadProgress(100);
          setIsInstalled(true);
        }
      });
    } catch (err) {
      console.error("下载安装失败:", err);
      setError(err instanceof Error ? err.message : "下载安装失败");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleRestart = async () => {
    try {
      await relaunchApp();
    } catch (err) {
      console.error("重启失败:", err);
      setError("重启失败，请手动重启应用");
    }
  };

  const handleDismissAndClose = () => {
    dismissUpdate();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-md w-full mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              发现新版本
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="关闭"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="mb-4">
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                当前版本:
              </span>
              <span className="text-sm font-mono text-gray-700 dark:text-gray-300">
                v{updateInfo.currentVersion}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                最新版本:
              </span>
              <span className="text-base font-mono font-semibold text-blue-600 dark:text-blue-400">
                v{updateInfo.availableVersion}
              </span>
            </div>
          </div>

          {/* Release Notes */}
          {updateInfo.notes && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                更新内容：
              </h3>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 max-h-48 overflow-y-auto">
                <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap font-sans">
                  {updateInfo.notes}
                </pre>
              </div>
            </div>
          )}

          {/* Progress */}
          {isDownloading && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  下载中...
                </span>
                <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  {downloadProgress}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Success */}
          {isInstalled && (
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm text-green-700 dark:text-green-400">
                ✓ 更新已安装，请重启应用以使用新版本
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleDismissAndClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            disabled={isDownloading}
          >
            稍后提醒
          </button>
          {isInstalled ? (
            <button
              onClick={handleRestart}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              立即重启
            </button>
          ) : (
            <button
              onClick={handleDownloadAndInstall}
              disabled={isDownloading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
            >
              {isDownloading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  下载中...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  立即更新
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}



