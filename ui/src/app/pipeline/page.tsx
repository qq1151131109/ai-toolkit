'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Progress {
  currentStep: number;
  totalSteps: number;
  stepName: string;
  percentage: number;
  current: number;
  total: number;
}

interface PipelineSummary {
  status?: string;
  elapsedTime?: number;
  datasetPath?: string;
  cleanedImages?: string;
  trainingStarted?: boolean;
  error?: string;
  failedStep?: number;
}

interface TaskStatus {
  status: 'running' | 'completed' | 'error' | 'paused';
  username: string;
  progress: Progress;
  datasetPath?: string;
  summary?: PipelineSummary;
  error?: string;
}

const STEP_ICONS = ['📥', '🧹', '🏷️', '🚀'];
const STEP_NAMES = ['数据抓取', '数据清洗', '自动标注', '启动训练'];

export default function PipelinePage() {
  const router = useRouter();

  // 表单状态
  const [username, setUsername] = useState('');
  const [maxPosts, setMaxPosts] = useState<number>(30);
  const [concurrent, setConcurrent] = useState<number>(10);
  const [minResolution, setMinResolution] = useState<number>(512);
  const [minQuality, setMinQuality] = useState<number>(60);
  const [enableDedup, setEnableDedup] = useState(true);
  const [triggerWord, setTriggerWord] = useState('');
  const [trainingSteps, setTrainingSteps] = useState<number | undefined>(undefined);
  const [autoStartTraining, setAutoStartTraining] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // 流水线状态
  const [isRunning, setIsRunning] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<TaskStatus | null>(null);

  // 轮询任务进度
  useEffect(() => {
    if (!currentTaskId || !isRunning) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/pipeline/status?taskId=${currentTaskId}`);
        if (response.ok) {
          const data = await response.json();
          setTaskStatus(data);

          // 如果任务完成、失败或暂停，停止轮询
          if (data.status === 'completed' || data.status === 'error' || data.status === 'paused') {
            setIsRunning(false);
            clearInterval(interval);

            // 如果暂停（清洗完成），跳转到数据集页面
            if (data.status === 'paused' && data.username) {
              setTimeout(() => {
                router.push(`/datasets/${data.username}`);
              }, 2000);
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch task status:', error);
      }
    }, 2000); // 每2秒轮询一次

    return () => clearInterval(interval);
  }, [currentTaskId, isRunning, router]);

  const startPipeline = async () => {
    if (!username.trim()) {
      alert('请输入 Instagram 用户名');
      return;
    }

    setIsRunning(true);
    setTaskStatus(null);

    try {
      const response = await fetch('/api/pipeline/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          maxPosts,
          concurrent,
          minResolution,
          minQuality,
          enableDedup,
          triggerWord: triggerWord || undefined,
          trainingSteps: trainingSteps || undefined,
          autoStartTraining
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '启动流水线失败');
      }

      const { taskId } = await response.json();
      setCurrentTaskId(taskId);
    } catch (error: any) {
      alert(`错误: ${error.message}`);
      setIsRunning(false);
    }
  };

  const goToDataset = () => {
    if (taskStatus?.username) {
      router.push(`/datasets/${taskStatus.username}`);
    }
  };

  const goToJobs = () => {
    router.push('/jobs');
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              🔄 自动化流水线
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              一键完成：数据抓取 → 清洗 → 人工筛选 → 标注 → 训练
            </p>
          </div>
          <Link
            href="/datasets"
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            ← 返回数据集
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-6">

          {/* 配置表单 */}
          {!isRunning && !taskStatus && (
            <>
              {/* 配置卡片 */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  启动配置
                </h2>

                <div className="space-y-4">
                  {/* Instagram 用户名 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Instagram 用户名 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      placeholder="@username 或 https://www.instagram.com/username/"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      💡 API Keys 已在服务器端配置（TIKHUB_API_KEY、OPENAI_API_KEY）
                    </p>
                  </div>

                  {/* 高级选项 */}
                  <div className="pt-2">
                    <button
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                    >
                      <span>{showAdvanced ? '▼' : '▶'}</span>
                      <span>高级选项</span>
                    </button>

                    {showAdvanced && (
                      <div className="mt-4 space-y-4 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
                        {/* 数据抓取选项 */}
                        <div className="space-y-3">
                          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">数据抓取</h3>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                                最大帖子数
                              </label>
                              <input
                                type="number"
                                value={maxPosts}
                                onChange={e => setMaxPosts(parseInt(e.target.value) || 30)}
                                min="1"
                                max="1000"
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                              />
                            </div>
                            <div>
                              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                                并发下载数
                              </label>
                              <input
                                type="number"
                                value={concurrent}
                                onChange={e => setConcurrent(parseInt(e.target.value) || 10)}
                                min="1"
                                max="50"
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                              />
                            </div>
                          </div>
                        </div>

                        {/* 数据清洗选项 */}
                        <div className="space-y-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">数据清洗</h3>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                                最小分辨率 (像素)
                              </label>
                              <input
                                type="number"
                                value={minResolution}
                                onChange={e => setMinResolution(parseInt(e.target.value) || 512)}
                                min="256"
                                max="2048"
                                step="64"
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                              />
                            </div>
                            <div>
                              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                                最小质量分数 (0-100)
                              </label>
                              <input
                                type="number"
                                value={minQuality}
                                onChange={e => setMinQuality(parseFloat(e.target.value) || 60)}
                                min="0"
                                max="100"
                                step="5"
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                              />
                            </div>
                          </div>

                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={enableDedup}
                              onChange={e => setEnableDedup(e.target.checked)}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              启用去重检测
                            </span>
                          </label>
                        </div>

                        {/* 训练选项 */}
                        <div className="space-y-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">训练选项</h3>

                          <div>
                            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                              触发词（可选，默认为用户名）
                            </label>
                            <input
                              type="text"
                              value={triggerWord}
                              onChange={e => setTriggerWord(e.target.value)}
                              placeholder="留空使用用户名"
                              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                            />
                          </div>

                          <div>
                            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                              训练步数（可选，默认自动计算）
                            </label>
                            <input
                              type="number"
                              value={trainingSteps || ''}
                              onChange={e => setTrainingSteps(e.target.value ? parseInt(e.target.value) : undefined)}
                              placeholder="留空自动计算"
                              min="100"
                              max="10000"
                              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                            />
                          </div>

                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={autoStartTraining}
                              onChange={e => setAutoStartTraining(e.target.checked)}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              完成后自动启动训练
                            </span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 启动按钮 */}
                  <div className="pt-4">
                    <button
                      onClick={startPipeline}
                      disabled={!username.trim()}
                      className="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isRunning ? '⏳ 启动中...' : '🚀 启动自动化流水线'}
                    </button>
                  </div>
                </div>
              </div>

              {/* 使用说明 */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-6">
                <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-3">
                  ℹ️ 流水线说明
                </h3>
                <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
                  <li>• <strong>步骤1 - 数据抓取</strong>: 使用TikHub从Instagram下载用户图片</li>
                  <li>• <strong>步骤2 - 数据清洗</strong>: 人脸检测、质量评分、去重，过滤低质量图片</li>
                  <li>• <strong>步骤3 - 人工筛选</strong>: 清洗完成后，您可以手动删除不合适的图片</li>
                  <li>• <strong>步骤4 - 自动标注</strong>: 使用GPT-4o为图片生成描述标注</li>
                  <li>• <strong>步骤5 - 启动训练</strong> (可选): 自动生成配置并启动LoRA训练</li>
                  <li>• API Keys需在 <code className="bg-blue-100 dark:bg-blue-900/50 px-1 rounded">.env</code> 文件中配置</li>
                </ul>
              </div>
            </>
          )}

          {/* 流水线进度 */}
          {taskStatus && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">
                流水线执行进度
              </h2>

              {/* 步骤指示器 */}
              <div className="mb-8">
                <div className="flex items-center justify-between">
                  {STEP_NAMES.slice(0, taskStatus.progress.totalSteps).map((name, index) => {
                    const stepNumber = index + 1;
                    const isCompleted = stepNumber < taskStatus.progress.currentStep;
                    const isCurrent = stepNumber === taskStatus.progress.currentStep;
                    const isError = taskStatus.status === 'error' && isCurrent;

                    return (
                      <div key={index} className="flex-1 relative">
                        <div className="flex flex-col items-center">
                          {/* 步骤圆圈 */}
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl mb-2 border-2 ${
                            isError
                              ? 'bg-red-100 dark:bg-red-900/20 border-red-500 text-red-600 dark:text-red-400'
                              : isCompleted
                              ? 'bg-green-100 dark:bg-green-900/20 border-green-500 text-green-600 dark:text-green-400'
                              : isCurrent
                              ? 'bg-blue-100 dark:bg-blue-900/20 border-blue-500 text-blue-600 dark:text-blue-400 animate-pulse'
                              : 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-400'
                          }`}>
                            {isError ? '❌' : isCompleted ? '✅' : STEP_ICONS[index]}
                          </div>

                          {/* 步骤名称 */}
                          <div className={`text-xs font-medium text-center ${
                            isCurrent
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-gray-600 dark:text-gray-400'
                          }`}>
                            {name}
                          </div>
                        </div>

                        {/* 连接线 */}
                        {index < taskStatus.progress.totalSteps - 1 && (
                          <div className={`absolute top-6 left-1/2 w-full h-0.5 ${
                            isCompleted
                              ? 'bg-green-500'
                              : 'bg-gray-300 dark:bg-gray-600'
                          }`} style={{ marginLeft: '24px' }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 当前步骤进度 */}
              {taskStatus.status === 'running' && (
                <div className="mb-6">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-700 dark:text-gray-300">
                      {taskStatus.progress.stepName}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400">
                      {taskStatus.progress.percentage.toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${taskStatus.progress.percentage}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 text-center mt-4">
                    正在执行中，请耐心等待...
                  </p>
                </div>
              )}

              {/* 暂停状态（等待人工筛选） */}
              {taskStatus.status === 'paused' && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-md p-4 border border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">⏸️</span>
                    <div>
                      <div className="font-semibold text-yellow-800 dark:text-yellow-200">
                        数据清洗完成，等待人工筛选
                      </div>
                      <div className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                        正在跳转到数据集页面...请删除不合适的图片，然后点击"继续流水线"按钮
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 完成状态 */}
              {taskStatus.status === 'completed' && taskStatus.summary && (
                <div className="space-y-4">
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-md p-4 border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🎉</span>
                      <div>
                        <div className="font-semibold text-green-800 dark:text-green-200">
                          流水线执行完成！
                        </div>
                        <div className="text-sm text-green-700 dark:text-green-300 mt-1">
                          耗时: {taskStatus.summary.elapsedTime?.toFixed(2)}秒
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={goToDataset}
                      className="px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors"
                    >
                      查看数据集 →
                    </button>
                    {taskStatus.summary.trainingStarted && (
                      <button
                        onClick={goToJobs}
                        className="px-6 py-3 bg-purple-600 text-white font-medium rounded-md hover:bg-purple-700 transition-colors"
                      >
                        查看训练队列 →
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* 错误状态 */}
              {taskStatus.status === 'error' && (
                <div className="bg-red-50 dark:bg-red-900/20 rounded-md p-4 border border-red-200 dark:border-red-800">
                  <div className="flex items-start gap-2">
                    <span className="text-2xl">❌</span>
                    <div>
                      <div className="font-semibold text-red-800 dark:text-red-200">
                        流水线执行失败
                      </div>
                      <div className="text-sm text-red-700 dark:text-red-300 mt-1">
                        {taskStatus.error || '未知错误'}
                      </div>
                      {taskStatus.summary?.failedStep && (
                        <div className="text-sm text-red-600 dark:text-red-400 mt-2">
                          失败步骤: {STEP_NAMES[taskStatus.summary.failedStep - 1]}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
