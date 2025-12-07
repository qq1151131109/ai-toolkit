import { NextRequest, NextResponse } from 'next/server';
import { getTask } from '@/lib/taskStorage';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get('taskId');

  if (!taskId) {
    return NextResponse.json({ error: '缺少 taskId 参数' }, { status: 400 });
  }

  const task = getTask(taskId);

  if (!task) {
    return NextResponse.json({ error: '任务不存在' }, { status: 404 });
  }

  return NextResponse.json(task);
}
