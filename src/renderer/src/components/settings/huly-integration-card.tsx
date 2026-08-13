import { useEffect } from 'react'
import { AlertCircle, CheckCircle2, ExternalLink, RefreshCw, Unlink } from 'lucide-react'
import { toast } from 'sonner'
import { HulyIcon } from '@/components/icons/HulyIcon'
import { Button } from '@/components/ui/button'
import { IntegrationCardDetails, IntegrationCardShell } from './integration-card-shell'
import { HulyAgentSkillInstallCta } from './huly-agent-skill-install-cta'
import { ProviderHostScopeControl } from './ProviderHostScopeControl'
import { HULY_INTEGRATION_SECTION_ID } from './task-provider-integration-section-ids'
import { getProviderAccountScope } from './provider-account-scope'
import { getProviderRuntimeContextKey, hasRemoteProviderRuntime } from '@/lib/provider-runtime-context'
import { useAppStore } from '@/store'
import { HULY_CLI_INSTALL_COMMAND } from '@/lib/agent-feature-install-commands'
import { translate } from '@/i18n/i18n'

export function HulyIntegrationCard(): React.JSX.Element {
  const status = useAppStore((s) => s.hulyStatus)
  const statusChecked = useAppStore((s) => s.hulyStatusChecked)
  const statusContextKey = useAppStore((s) => s.hulyStatusContextKey)
  const preflight = useAppStore((s) => s.hulyPreflightStatus)
  const enableHuly = useAppStore((s) => s.enableHuly)
  const disableHuly = useAppStore((s) => s.disableHuly)
  const checkConnection = useAppStore((s) => s.checkHulyConnection)
  const refreshPreflight = useAppStore((s) => s.refreshHulyPreflight)
  const settings = useAppStore((s) => s.settings)

  const contextKey = getProviderRuntimeContextKey(settings)
  const contextMatches = statusContextKey === contextKey
  const checking = !contextMatches || !statusChecked
  const cliReady = preflight?.installed === true && preflight?.authenticated === true
  const enabled = contextMatches && status?.enabled === true
  const connected = enabled && status?.available === true
  const viewer = status?.viewer
  const accountScope = getProviderAccountScope(settings)
  const isRemote = hasRemoteProviderRuntime(settings)
  const installHost = isRemote ? 'Orca server' : 'this machine'

  useEffect(() => {
    void refreshPreflight()
    void checkConnection(true)
  }, [contextKey, refreshPreflight, checkConnection])

  const statusTone: 'connected' | 'attention' = connected ? 'connected' : 'attention'
  const statusLabel = connected
    ? translate('auto.components.settings.huly.integration.card.statusConnected', 'Connected')
    : cliReady
      ? translate('auto.components.settings.huly.integration.card.statusReady', 'Ready')
      : translate(
          'auto.components.settings.huly.integration.card.statusNotConnected',
          'Not connected'
        )

  const description = connected
    ? translate(
        'auto.components.settings.huly.integration.card.descriptionConnected',
        'Connected to Huly via the huly CLI.'
      )
    : checking
      ? translate(
          'auto.components.settings.huly.integration.card.descriptionChecking',
          'Checking Huly CLI access before showing setup actions.'
        )
      : cliReady
        ? translate(
            'auto.components.settings.huly.integration.card.descriptionReady',
            'huly CLI detected. Click Connect to enable.'
          )
        : translate(
            'auto.components.settings.huly.integration.card.descriptionDefault',
            'Browse, create, and start work from Huly issues.'
          )

  const action = connected ? (
    <Button variant="outline" size="sm" onClick={() => void disableHuly()}>
      <Unlink className="mr-1.5 size-3.5" />
      {translate('auto.components.settings.huly.integration.card.disconnect', 'Disconnect')}
    </Button>
  ) : cliReady ? (
    <Button
      size="sm"
      onClick={() => {
        enableHuly().catch((error: unknown) => {
          toast.error(error instanceof Error ? error.message : 'Failed to connect Huly.')
        })
      }}
    >
      {translate(
        'auto.components.settings.huly.integration.card.connect',
        'Connect via huly CLI'
      )}
    </Button>
  ) : null

  return (
    <IntegrationCardShell
      settingsSectionId={HULY_INTEGRATION_SECTION_ID}
      icon={<HulyIcon className="size-5" />}
      name="Huly"
      description={description}
      statusLabel={statusLabel}
      statusTone={statusTone}
      checking={checking}
      actions={!checking ? action : null}
    >
      <IntegrationCardDetails>
        <ProviderHostScopeControl
          labelPrefix={translate(
            'auto.components.settings.huly.integration.card.scope',
            'Account scope'
          )}
          scope={accountScope}
          showOpenServersAction={false}
          className="text-xs"
        />

        {connected && viewer ? <ConnectedViewerRow viewer={viewer} /> : null}

        {connected ? (
          <Button variant="ghost" size="sm" onClick={() => void checkConnection(true)}>
            <RefreshCw className="mr-1.5 size-3.5" />
            {translate('auto.components.settings.huly.integration.card.recheck', 'Re-check')}
          </Button>
        ) : !checking ? (
          <PreflightStatus
            preflight={preflight}
            installHost={installHost}
            installCommand={HULY_CLI_INSTALL_COMMAND}
            onRecheck={() => void refreshPreflight()}
          />
        ) : null}

        <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
          {translate(
            'auto.components.settings.huly.integration.card.cliAuthManagedByCli',
            'Auth and URL are managed by the huly CLI. Change them with `huly auth login` or `huly workspace switch`.'
          )}{' '}
          <a
            href="https://github.com/IamCoder18/huly-cli"
            target="_blank"
            rel="noreferrer"
            aria-label={translate(
              'auto.components.settings.huly.integration.card.copyLinkAria',
              'Open huly CLI repository'
            )}
            className="inline-flex items-center gap-0.5 text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="size-3" />
            {translate(
              'auto.components.settings.huly.integration.card.cliRepoLink',
              'IamCoder18/huly-cli'
            )}
          </a>
        </p>

        <HulyAgentSkillInstallCta settings={settings} />
      </IntegrationCardDetails>
    </IntegrationCardShell>
  )
}

function ConnectedViewerRow({
  viewer
}: {
  viewer: NonNullable<ReturnType<typeof useAppStore.getState>['hulyStatus']>['viewer']
}): React.JSX.Element {
  if (!viewer) return <></>
  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{viewer.displayName}</p>
        <p className="truncate text-xs text-muted-foreground">
          {viewer.email ?? ''}
          {viewer.workspaceName ? (viewer.email ? ' · ' : '') + viewer.workspaceName : ''}
        </p>
      </div>
    </div>
  )
}

function PreflightStatus({
  preflight,
  installHost,
  installCommand,
  onRecheck
}: {
  preflight: ReturnType<typeof useAppStore.getState>['hulyPreflightStatus']
  installHost: string
  installCommand: string
  onRecheck: () => void
}): React.JSX.Element {
  if (!preflight) {
    return <></>
  }
  if (!preflight.installed) {
    return (
      <div className="space-y-2">
        <p className="inline-flex items-center gap-1.5 text-xs text-status-warning">
          <AlertCircle className="size-3.5" />
          {translate(
            'auto.components.settings.huly.integration.card.cliNotDetected',
            'huly CLI not detected on {{value0}}. Run: {{value1}}',
            { value0: installHost, value1: installCommand }
          )}
        </p>
        <Button variant="ghost" size="sm" onClick={onRecheck}>
          <RefreshCw className="mr-1.5 size-3.5" />
          {translate('auto.components.settings.huly.integration.card.recheck', 'Re-check')}
        </Button>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      <p
        className={
          preflight.authenticated
            ? 'inline-flex items-center gap-1.5 text-xs text-status-success'
            : 'inline-flex items-center gap-1.5 text-xs text-status-warning'
        }
      >
        {preflight.authenticated ? (
          <CheckCircle2 className="size-3.5" />
        ) : (
          <AlertCircle className="size-3.5" />
        )}
        {translate(
          'auto.components.settings.huly.integration.card.cliInstalled',
          'huly CLI installed'
        )}
        {preflight.version
          ? translate(
              'auto.components.settings.huly.integration.card.cliInstalledWithVersion',
              ' ({{value0}})',
              { value0: preflight.version }
            )
          : ''}
        {preflight.authenticated
          ? ''
          : translate(
              'auto.components.settings.huly.integration.card.cliAuthRequired',
              ' — run `huly auth login` on {{value0}}.',
              { value0: installHost }
            )}
      </p>
      <Button variant="ghost" size="sm" onClick={onRecheck}>
        <RefreshCw className="mr-1.5 size-3.5" />
        {translate('auto.components.settings.huly.integration.card.recheck', 'Re-check')}
      </Button>
    </div>
  )
}
