import { useMemo } from 'react'
import { Copy, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { IntegrationStatusPill } from '@/components/integration-status-pill'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  GLOBAL_AGENT_SKILL_SOURCE_KINDS,
  useInstalledAgentSkillNames
} from '@/hooks/useInstalledAgentSkills'
import {
  HULY_AGENT_SKILL_INSTALL_COMMAND,
  HULY_AGENT_SKILL_UPDATE_COMMAND,
  HULY_AGENT_SKILL_NAMES,
  HULY_CLI_SKILL_NAME
} from '@/lib/agent-feature-install-commands'
import { getCurrentPlatform, getLinearPromptAgentRuntime, getLinearPromptSkillDiscoveryTarget, type LinearAgentSkillPromptSettings } from '../sidebar/linear-agent-skill-runtime'
import { getLinearAgentSkillSetupInlineRuntimeCopy } from '../sidebar/linear-agent-skill-setup-copy'
import { buildSkillCommandForRuntime } from './CliSkillRuntimeSetup'
import { useIntegrationCommandRowClass, useIntegrationSubordinateRowClass } from './integration-card-presentation'
import { translate } from '@/i18n/i18n'

type Props = { settings: LinearAgentSkillPromptSettings | null | undefined }

export function HulyAgentSkillInstallCta({ settings }: Props): React.JSX.Element {
  const remote = Boolean(settings?.activeRuntimeEnvironmentId?.trim())
  const agentRuntime = useMemo(
    () => getLinearPromptAgentRuntime(settings, getCurrentPlatform(), remote),
    [remote, settings]
  )
  const discoveryTarget = useMemo(
    () => getLinearPromptSkillDiscoveryTarget(agentRuntime),
    [agentRuntime]
  )
  const skill = useInstalledAgentSkillNames(HULY_AGENT_SKILL_NAMES, {
    discoveryTarget,
    sourceKinds: GLOBAL_AGENT_SKILL_SOURCE_KINDS
  })
  const command = useMemo(
    () =>
      buildSkillCommandForRuntime(
        skill.installed ? HULY_AGENT_SKILL_UPDATE_COMMAND : HULY_AGENT_SKILL_INSTALL_COMMAND,
        agentRuntime
      ),
    [agentRuntime, skill.installed]
  )
  const subordinateRowClass = useIntegrationSubordinateRowClass('space-y-1.5')
  const commandRowClass = useIntegrationCommandRowClass()

  const copyCommand = async (): Promise<void> => {
    try {
      await window.api.ui.writeClipboardText(command)
      toast.success(
        translate(
          'auto.components.settings.huly.agent.skill.install.cta.copiedCommand',
          'Copied command.'
        )
      )
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : translate(
              'auto.components.settings.huly.agent.skill.install.cta.copyFailed',
              'Failed to copy command.'
            )
      )
    }
  }

  return (
    <div className={subordinateRowClass}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-medium text-foreground">
          {translate(
            'auto.components.settings.huly.agent.skill.install.cta.skillLabel',
            'Agent skill:'
          )}{' '}
          <span className="font-mono text-[11px]">{HULY_CLI_SKILL_NAME}</span>
        </p>
        {skill.loading ? (
          <IntegrationStatusPill tone="neutral">
            {translate(
              'auto.components.settings.huly.agent.skill.install.cta.checking',
              'Checking...'
            )}
          </IntegrationStatusPill>
        ) : skill.installed ? (
          <IntegrationStatusPill tone="connected">
            {translate(
              'auto.components.settings.huly.agent.skill.install.cta.installed',
              'Installed'
            )}
          </IntegrationStatusPill>
        ) : (
          <IntegrationStatusPill tone="attention">
            {translate(
              'auto.components.settings.huly.agent.skill.install.cta.notInstalled',
              'Not installed'
            )}
          </IntegrationStatusPill>
        )}
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="ml-auto gap-1.5"
          onClick={() => void skill.refresh()}
          disabled={skill.loading}
        >
          <RefreshCw className={`size-3 ${skill.loading ? 'animate-spin' : ''}`} />
          {translate('auto.components.settings.huly.agent.skill.cta.recheck', 'Re-check')}
        </Button>
      </div>
      {skill.error ? <p className="text-xs text-destructive">{skill.error}</p> : null}
      {!skill.loading ? (
        <>
          <p className="text-xs text-muted-foreground">
            {skill.installed
              ? translate(
                  'auto.components.settings.huly.agent.skill.install.cta.installedDescription',
                  'Agent skill installed. To update it, run:'
                )
              : translate(
                  'auto.components.settings.huly.agent.skill.install.cta.description',
                  'Let agents read and edit Huly tasks. Full guided setup is under Settings → Task Sources.'
                )}
          </p>
          <div className={commandRowClass}>
            <code className="scrollbar-sleek min-w-0 flex-1 overflow-x-auto whitespace-nowrap">
              {command}
            </code>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="shrink-0"
                  aria-label={translate(
                    'auto.components.settings.huly.agent.skill.install.cta.copyCommand',
                    'Copy command'
                  )}
                  onClick={() => void copyCommand()}
                >
                  <Copy className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={4}>
                {translate(
                  'auto.components.settings.huly.agent.skill.install.cta.copyCommand',
                  'Copy command'
                )}
              </TooltipContent>
            </Tooltip>
          </div>
          {remote || agentRuntime.runtime === 'wsl' ? (
            <p className="text-[11px] text-muted-foreground/70">
              {getLinearAgentSkillSetupInlineRuntimeCopy(remote, agentRuntime)}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  )
}