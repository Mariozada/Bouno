import { type FC, useMemo, useState } from 'react'
import * as m from 'motion/react-m'
import { Check, ChevronDown, ChevronUp, Copy, RefreshCw, Square } from 'lucide-react'
import { MarkdownMessage } from '../MarkdownMessage'
import { ToolCallDisplay } from '../ToolCallDisplay'
import { formatToolName } from '../ToolCallDisplay/helpers'
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
  // Group consecutive tool_call segments into blocks
  type RenderedBlock =
    | { type: 'text'; segment: AssistantMessageSegment & { type: 'text' } }
    | { type: 'tool_group'; toolCallIds: string[]; anchorId: string }

  const renderedBlocks = useMemo<RenderedBlock[]>(() => {
    const blocks: RenderedBlock[] = []
    let currentGroup: { toolCallIds: string[]; anchorId: string } | null = null

    for (const segment of orderedSegments) {
      if (segment.type === 'tool_call') {
        if (!toolCallsById.has(segment.toolCallId)) continue
        if (currentGroup) {
          currentGroup.toolCallIds.push(segment.toolCallId)
        } else {
          currentGroup = { toolCallIds: [segment.toolCallId], anchorId: segment.id }
        }
      } else {
        if (currentGroup) {
          blocks.push({ type: 'tool_group', ...currentGroup })
          currentGroup = null
        }
        blocks.push({ type: 'text', segment: segment as AssistantMessageSegment & { type: 'text' } })
      }
    }
    if (currentGroup) {
      blocks.push({ type: 'tool_group', ...currentGroup })
    }
    return blocks
  }, [orderedSegments, toolCallsById])

  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set())

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
        {renderedBlocks.map((block) => {
          if (block.type === 'text') {
            if (!block.segment.text) return null
            return (
              <MarkdownMessage
                key={block.segment.id}
                content={block.segment.text}
                isStreaming={isStreaming && block.segment.id === lastTextSegmentId}
              />
            )
          }

          const groupTools = block.toolCallIds
            .map((id) => toolCallsById.get(id))
            .filter((tc): tc is ToolCallInfo => tc !== undefined)
          if (groupTools.length === 0) return null

          const isExpanded = expandedGroupIds.has(block.anchorId)

          // Determine the group's summary status dot
          const hasRunning = groupTools.some((tc) => tc.status === 'running')
          const hasPending = groupTools.some((tc) => tc.status === 'pending')
          const hasError = groupTools.some((tc) => tc.status === 'error')
          const dotStatus = hasRunning ? 'running' : hasPending ? 'pending' : hasError ? 'error' : 'completed'

          // Label for the collapsed row
          let collapsedLabel: string
          if (groupTools.length === 1) {
            collapsedLabel = formatToolName(groupTools[0].name)
          } else {
            const activeTool = groupTools.find((tc) => tc.status === 'running') || groupTools[groupTools.length - 1]
            collapsedLabel = `${groupTools.length} tools · ${formatToolName(activeTool.name)}`
          }

          return (
            <div key={block.anchorId} className="message-tool-calls">
              <button
                type="button"
                className="tool-strip-collapsed"
                onClick={() => setExpandedGroupIds((prev) => {
                  const next = new Set(prev)
                  if (next.has(block.anchorId)) {
                    next.delete(block.anchorId)
                  } else {
                    next.add(block.anchorId)
                  }
                  return next
                })}
                aria-expanded={isExpanded}
              >
                <span className="tool-strip-collapsed-main">
                  <span className={`tool-strip-chip-dot tool-strip-chip-dot--${dotStatus}`} />
                  <span className="tool-strip-collapsed-text">{collapsedLabel}</span>
                </span>
                <span className="tool-strip-collapsed-right">
                  {hasError && (
                    <span className="tool-strip-collapsed-badge tool-strip-collapsed-badge--error">!</span>
                  )}
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </span>
              </button>

              {isExpanded && (
                <div className="tool-strip-expanded">
                  {groupTools.map((tc) => (
                    <ToolCallDisplay key={tc.id} toolCall={tc} />
                  ))}
                </div>
              )}
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
