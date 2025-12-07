import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import { createTask, updateTask, getTask } from '@/lib/taskStorage';

export async function POST(request: NextRequest) {
  try {
    const {
      username,
      maxPosts,
      concurrent,
      minResolution,
      minQuality,
      enableDedup,
      triggerWord,
      trainingSteps,
      autoStartTraining
    } = await request.json();

    // 验证用户名
    if (!username) {
      return NextResponse.json(
        { error: '缺少必要参数: username' },
        { status: 400 }
      );
    }

    // 从环境变量读取 API Keys
    const tikHubApiKey = process.env.TIKHUB_API_KEY;
    const gpt4oApiKey = process.env.OPENAI_API_KEY;

    // 验证 API Keys
    if (!tikHubApiKey) {
      return NextResponse.json(
        { error: '未配置 TIKHUB_API_KEY，请在 .env 文件中添加' },
        { status: 500 }
      );
    }

    if (!gpt4oApiKey) {
      return NextResponse.json(
        { error: '未配置 OPENAI_API_KEY，请在 .env 文件中添加' },
        { status: 500 }
      );
    }

    // 生成任务 ID
    const taskId = `pipeline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 清理用户名
    const cleanUsername = username.replace(/^@/, '').split('/').filter((s: string) => s).pop() || username;

    // 设置路径
    const toolkitRoot = path.join(process.cwd(), '..');
    const datasetPath = path.join(toolkitRoot, 'datasets', cleanUsername);

    // 初始化任务状态
    createTask(taskId, {
      status: 'running',
      username: cleanUsername,
      progress: {
        currentStep: 0,
        totalSteps: autoStartTraining ? 4 : 3,
        stepName: '准备中',
        percentage: 0,
        current: 0,
        total: 0
      },
      datasetPath: datasetPath,
      summary: null,
      error: null,
      startedAt: new Date().toISOString()
    });

    // 构建 Python 脚本路径
    const scriptPath = path.join(toolkitRoot, 'scripts', 'pipeline_runner.py');

    // 构建命令参数
    const args = [
      scriptPath,
      '--username', username,
      '--tikhub-api-key', tikHubApiKey,
      '--gpt4o-api-key', gpt4oApiKey
    ];

    if (maxPosts) {
      args.push('--max-posts', maxPosts.toString());
    }
    if (concurrent) {
      args.push('--concurrent', concurrent.toString());
    }
    if (minResolution) {
      args.push('--min-resolution', minResolution.toString());
    }
    if (minQuality) {
      args.push('--min-quality', minQuality.toString());
    }
    if (enableDedup === false) {
      args.push('--no-dedup');
    }
    if (triggerWord) {
      args.push('--trigger-word', triggerWord);
    }
    if (trainingSteps) {
      args.push('--training-steps', trainingSteps.toString());
    }
    if (autoStartTraining) {
      args.push('--auto-start-training');
    }

    console.log(`[Pipeline] Starting task ${taskId} for user: ${cleanUsername}`);

    // 启动 Python 流水线脚本
    const pythonProcess = spawn('python3', args);

    // 解析 stdout 获取进度
    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`[Pipeline ${taskId}] ${output.trim()}`);

      // 解析流水线进度 JSON
      const progressMatch = output.match(/PIPELINE_PROGRESS:(.+)/);
      if (progressMatch) {
        try {
          const progressData = JSON.parse(progressMatch[1]);
          updateTask(taskId, {
            progress: {
              currentStep: progressData.currentStep,
              totalSteps: progressData.totalSteps,
              stepName: progressData.stepName,
              percentage: progressData.percentage,
              current: progressData.currentStep,
              total: progressData.totalSteps
            }
          });

          // 如果某个步骤失败，更新错误状态
          if (progressData.status === 'error') {
            updateTask(taskId, {
              status: 'error',
              error: progressData.message
            });
          }
        } catch (e) {
          console.error(`[Pipeline ${taskId}] Failed to parse progress JSON:`, e);
        }
      }

      // 解析最终摘要 JSON
      const summaryMatch = output.match(/PIPELINE_SUMMARY:(.+)/);
      if (summaryMatch) {
        try {
          const summaryData = JSON.parse(summaryMatch[1]);
          updateTask(taskId, {
            summary: summaryData.summary,
            status: summaryData.success ? 'completed' : 'error',
            error: summaryData.success ? null : summaryData.summary.error
          });
        } catch (e) {
          console.error(`[Pipeline ${taskId}] Failed to parse summary JSON:`, e);
        }
      }
    });

    // 捕获 stderr
    pythonProcess.stderr.on('data', (data) => {
      const error = data.toString();
      console.error(`[Pipeline ${taskId}] Error: ${error}`);
    });

    // 进程退出处理
    pythonProcess.on('close', (code) => {
      const task = getTask(taskId);
      if (code === 0 && task && task.status !== 'completed') {
        updateTask(taskId, {
          status: 'completed',
          completedAt: new Date().toISOString()
        });
      } else if (code !== 0) {
        const currentError = task?.error || `Process exited with code ${code}`;
        updateTask(taskId, {
          status: 'error',
          completedAt: new Date().toISOString(),
          error: currentError
        });
      }
      console.log(`[Pipeline ${taskId}] Process exited with code ${code}`);
    });

    // 错误处理
    pythonProcess.on('error', (err) => {
      console.error(`[Pipeline ${taskId}] Process error:`, err);
      updateTask(taskId, {
        status: 'error',
        error: err.message,
        completedAt: new Date().toISOString()
      });
    });

    // 返回任务信息
    return NextResponse.json({
      taskId,
      status: 'running',
      message: '流水线任务已启动'
    });

  } catch (error: any) {
    console.error('[Pipeline] Error starting pipeline:', error);
    return NextResponse.json(
      { error: error.message || '启动流水线任务失败' },
      { status: 500 }
    );
  }
}
