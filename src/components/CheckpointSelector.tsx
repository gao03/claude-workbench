import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkpoint } from '@/lib/agentSDK';
import { Clock, FileText, RotateCcw, Loader2 } from 'lucide-react';

interface CheckpointSelectorProps {
  sessionId: string;
  onRewind: (checkpointId: string) => Promise<void>;
  loadCheckpoints: () => Promise<Checkpoint[]>;
}

export const CheckpointSelector: React.FC<CheckpointSelectorProps> = ({
  sessionId,
  onRewind,
  loadCheckpoints,
}) => {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRewinding, setIsRewinding] = useState<string | null>(null);

  useEffect(() => {
    loadCheckpointsData();
  }, [sessionId]);

  const loadCheckpointsData = async () => {
    setIsLoading(true);
    try {
      const result = await loadCheckpoints();
      setCheckpoints(result);
    } catch (error) {
      console.error('Failed to load checkpoints:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRewind = async (checkpointId: string) => {
    setIsRewinding(checkpointId);
    try {
      await onRewind(checkpointId);
      // 重新加载检查点列表
      await loadCheckpointsData();
    } catch (error) {
      console.error('Failed to rewind:', error);
    } finally {
      setIsRewinding(null);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return timestamp;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">加载检查点...</span>
      </div>
    );
  }

  if (checkpoints.length === 0) {
    return (
      <div className="p-8 text-center">
        <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground">暂无可用的检查点</p>
        <p className="text-sm text-muted-foreground mt-2">
          检查点会在会话过程中自动创建
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 border rounded-lg bg-background">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center">
          <RotateCcw className="h-5 w-5 mr-2" />
          检查点列表
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={loadCheckpointsData}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            '刷新'
          )}
        </Button>
      </div>

      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-3">
          {checkpoints.map((checkpoint) => (
            <div
              key={checkpoint.id}
              className="p-3 border rounded-lg hover:bg-accent/50 transition-colors"
            >
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1 min-w-0">
                  {/* 消息内容 */}
                  <div className="flex items-start mb-2">
                    <FileText className="h-4 w-4 mr-2 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <p className="font-medium text-sm line-clamp-2 break-words">
                      {checkpoint.message || '无消息'}
                    </p>
                  </div>

                  {/* 时间戳 */}
                  <div className="flex items-center mb-1">
                    <Clock className="h-3 w-3 mr-1.5 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">
                      {formatTimestamp(checkpoint.timestamp)}
                    </p>
                  </div>

                  {/* 修改的文件 */}
                  {checkpoint.filesChanged && checkpoint.filesChanged.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      📁 修改了 {checkpoint.filesChanged.length} 个文件
                    </p>
                  )}
                </div>

                {/* 回退按钮 */}
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleRewind(checkpoint.id)}
                  disabled={isRewinding !== null}
                  className="flex-shrink-0"
                >
                  {isRewinding === checkpoint.id ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      回退中...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="h-3 w-3 mr-1" />
                      回退
                    </>
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

