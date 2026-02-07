import { type FC, useMemo } from 'react'
import * as m from 'motion/react-m'
import { Check, Copy, RefreshCw, Square } from 'lucide-react'
import { MarkdownMessage } from '../MarkdownMessage'
import { ToolCallDisplay } from '../ToolCallDisplay'
import { TooltipIconButton } from '../TooltipIconButton'
import { ThinkingBlock } from '../ThinkingBlock'
import type { ToolCallInfo, AssistantMessageSegment } from '@agent/index'

interface AssistantMessageProps {
  id: string
  content: string
  reasoning?: string
  toolCalls?: ToolCallInfo[]
  assistantSegments?: AssistantMessageSegment[]
  isStreaming: boolean
  isLastMessage: boolean
  isHovered: boolean
  isCopied: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
  onCopy: () => void
  onRetry: () => void
  onStop: () => void
}

export const AssistantMessage: FC<AssistantMessageProps> = ({
  content,
  reasoning,
  toolCalls,
  assistantSegments,
  isStreaming,
  isLastMessage,
  isHovered,
  isCopied,
  onMouseEnter,
  onMouseLeave,
  onCopy,
  onRetry,
  onStop,
}) => {
  const hasContent = content && content.trim().length > 0
  const hasToolCalls = toolCalls && toolCalls.length > 0
  const toolCallsById = useMemo(
    () => new Map((toolCalls || []).map((tc) => [tc.id, tc])),
    [toolCalls]
  )
  const orderedSegments = useMemo(() => {
    if (assistantSegments && assistantSegments.length > 0) {
      return assistantSegments
    }

    const fallback: AssistantMessageSegment[] = []
    if (hasContent) {
      fallback.push({
        type: 'text',
        id: 'fallback_text',
        text: content,
      })
    }

    for (const tc of toolCalls || []) {
      fallback.push({
        type: 'tool_call',
        id: `fallback_tool_${tc.id}`,
        toolCallId: tc.id,
      })
    }

    return fallback
  }, [assistantSegments, hasContent, content, toolCalls])
  const lastTextSegmentId = useMemo(() => {
    for (let i = orderedSegments.length - 1; i >= 0; i--) {
      if (orderedSegments[i].type === 'text') {
        return orderedSegments[i].id
      }
    }
    return null
  }, [orderedSegments])
  const isEmptyAssistant = orderedSegments.length === 0
  const showActionBar = isLastMessage || isHovered || isStreaming

  return (
    <m.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="aui-assistant-message-root"
      data-role="assistant"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="aui-assistant-message-content">
        {(reasoning || (isStreaming && !hasContent && !hasToolCalls)) && (
          <ThinkingBlock
            reasoning={reasoning || ''}
            isStreaming={isStreaming && !hasContent}
          />
        )}
        {orderedSegments.map((segment) => {
          if (segment.type === 'text') {
            if (!segment.text) return null
            return (
              <MarkdownMessage
                key={segment.id}
                content={segment.text}
                isStreaming={isStreaming && segment.id === lastTextSegmentId}
              />
            )
          }

          const toolCall = toolCallsById.get(segment.toolCallId)
          if (!toolCall) return null

          return (
            <div key={segment.id} className="message-tool-calls">
              <ToolCallDisplay toolCall={toolCall} />
            </div>
          )
        })}
        {isEmptyAssistant && !reasoning && isStreaming && (
          <div className="message-text message-loading">Thinking...</div>
        )}
        {isEmptyAssistant && !reasoning && !isStreaming && (
          <div className="message-text message-error">(Empty response)</div>
        )}
      </div>
      <div
        className={`aui-assistant-action-bar-root ${showActionBar ? '' : 'aui-action-bar-hidden'} ${!isLastMessage ? 'aui-action-bar-floating' : ''}`}
      >
        <TooltipIconButton
          tooltip={isCopied ? 'Copied' : 'Copy'}
          onClick={onCopy}
        >
          {isCopied ? <Check size={16} /> : <Copy size={16} />}
        </TooltipIconButton>
        <TooltipIconButton
          tooltip="Retry"
          onClick={onRetry}
          disabled={isStreaming}
        >
          <RefreshCw size={16} />
        </TooltipIconButton>
        {isStreaming && (
          <TooltipIconButton tooltip="Stop" onClick={onStop}>
            <Square size={14} />
          </TooltipIconButton>
        )}
      </div>
    </m.div>
  )
}
