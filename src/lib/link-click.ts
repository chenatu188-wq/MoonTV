import type { MouseEvent } from 'react';

/**
 * 卡片做成真的 <a> 连结，右键才有「在新分页开启」、Ctrl／Cmd／中键点才会开新分页。
 * 一般左键点仍照原本的方式（站内换页或开播放器）：是一般左键点就回 true，
 * 并取消浏览器预设的换页；其他点法交给浏览器。
 */
export function takeOverClick(e: MouseEvent): boolean {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)
    return false;
  e.preventDefault();
  return true;
}
