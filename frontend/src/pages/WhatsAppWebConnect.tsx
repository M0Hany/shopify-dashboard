import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftIcon, ArrowPathIcon, SignalIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';

const API = import.meta.env.VITE_API_URL;
const ADMIN_SECRET = import.meta.env.VITE_WHATSAPP_WEB_ADMIN_SECRET as string | undefined;

function webHeaders(): HeadersInit {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (ADMIN_SECRET) {
    headers['X-WhatsApp-Web-Secret'] = ADMIN_SECRET;
  }
  return headers;
}

type ConnectionStatus = 'disabled' | 'connecting' | 'qr' | 'connected' | 'disconnected';

const WhatsAppWebConnect: React.FC = () => {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [connectedPhone, setConnectedPhone] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [resetting, setResetting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const statusRes = await fetch(`${API}/api/whatsapp/web/status`, {
        headers: webHeaders()
      });
      if (statusRes.status === 401) {
        setStatusMessage('Unauthorized. Set VITE_WHATSAPP_WEB_ADMIN_SECRET to match the backend.');
        toast.error('WhatsApp Web admin secret mismatch');
        return;
      }
      if (!statusRes.ok) throw new Error('Failed to load status');
      const statusJson = await statusRes.json();
      const nextStatus = statusJson.status as ConnectionStatus;
      setStatus(nextStatus);
      setConnectedPhone(statusJson.connectedPhone ?? null);

      if (nextStatus === 'connected') {
        setQrDataUrl(null);
        setStatusMessage(null);
        return;
      }

      if (nextStatus === 'disabled' || statusJson.enabled === false) {
        setQrDataUrl(null);
        setStatusMessage(
          'Add WHATSAPP_WEB_ENABLED=true to backend/.env, save, then restart the backend (npm run dev).'
        );
        return;
      }

      const qrRes = await fetch(`${API}/api/whatsapp/web/qr`, { headers: webHeaders() });
      if (qrRes.status === 401) {
        setStatusMessage('Unauthorized. Set VITE_WHATSAPP_WEB_ADMIN_SECRET to match the backend.');
        return;
      }
      const qrJson = await qrRes.json();
      if (!qrRes.ok) {
        throw new Error(qrJson.error || 'Failed to load QR');
      }
      setQrDataUrl(qrJson.qrDataUrl ?? null);
      setStatusMessage(qrJson.message ?? null);
    } catch (e) {
      console.error(e);
      toast.error('Could not load WhatsApp connection status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => {
      void refresh();
    }, 4000);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleReset = async () => {
    setResetting(true);
    try {
      const res = await fetch(`${API}/api/whatsapp/web/reset`, {
        method: 'POST',
        headers: webHeaders()
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Reset failed');
      toast.success('Connection reset. Waiting for QR…');
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to reset connection');
    } finally {
      setResetting(false);
    }
  };

  const handleLogout = async () => {
    if (!window.confirm('Disconnect this WhatsApp session? You will need to scan QR again.')) {
      return;
    }
    setLoggingOut(true);
    try {
      const res = await fetch(`${API}/api/whatsapp/web/logout`, {
        method: 'POST',
        headers: webHeaders()
      });
      if (!res.ok) throw new Error('Logout failed');
      toast.success('Disconnected. Scan a new QR when ready.');
      await refresh();
    } catch {
      toast.error('Failed to disconnect');
    } finally {
      setLoggingOut(false);
    }
  };

  const statusLabel: Record<ConnectionStatus, string> = {
    disabled: 'Disabled on server',
    connecting: 'Connecting…',
    qr: 'Scan QR with your phone',
    connected: 'Connected',
    disconnected: 'Disconnected — reconnect below'
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-lg">
        <Link
          to="/whatsapp/templates"
          className="mb-6 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to templates
        </Link>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <SignalIcon className="h-6 w-6 text-green-600" />
            <h1 className="text-xl font-semibold text-gray-900">Link WhatsApp account</h1>
          </div>

          <p className="mb-6 text-sm text-gray-600">
            Connect your <strong>WhatsApp Business</strong> app (same number you use with customers).
            Automated <strong>order confirmed</strong> messages are sent from this account after the usual 1-hour delay.
            Other messages stay manual via Send template.
          </p>

          <div className="mb-6 rounded-lg bg-gray-50 px-4 py-3">
            <p className="text-sm font-medium text-gray-700">Status</p>
            <p className="text-sm text-gray-900">{loading ? 'Loading…' : statusLabel[status]}</p>
            {connectedPhone && (
              <p className="mt-1 text-xs text-gray-500">Linked: +{connectedPhone}</p>
            )}
          </div>

          {status === 'connected' ? (
            <div className="space-y-4">
              <p className="text-sm text-green-700">
                Your account is linked. New orders will receive the confirmation message automatically.
              </p>
              <button
                type="button"
                onClick={() => void handleLogout()}
                disabled={loggingOut}
                className="w-full rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                {loggingOut ? 'Disconnecting…' : 'Disconnect & use a different number'}
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              {qrDataUrl ? (
                <>
                  <img
                    src={qrDataUrl}
                    alt="WhatsApp QR code"
                    className="h-72 w-72 rounded-lg border border-gray-200"
                  />
                  <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-600">
                    <li>Open WhatsApp Business on your phone</li>
                    <li>Menu → Linked devices → Link a device</li>
                    <li>Scan this QR code</li>
                  </ol>
                </>
              ) : (
                <div className="space-y-3 text-center">
                  <p className="text-sm text-gray-500">
                    {statusMessage ||
                      (status === 'disabled'
                        ? 'Set WHATSAPP_WEB_ENABLED=true on the backend and restart the server.'
                        : status === 'disconnected'
                          ? 'Session expired or invalid. Reset the connection to get a new QR code.'
                          : 'Waiting for QR code…')}
                  </p>
                  {(status === 'disconnected' || status === 'connecting') && (
                    <button
                      type="button"
                      onClick={() => void handleReset()}
                      disabled={resetting}
                      className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                    >
                      {resetting ? 'Resetting…' : 'Reset connection & show QR'}
                    </button>
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  void refresh().finally(() => setLoading(false));
                }}
                className="inline-flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800"
              >
                <ArrowPathIcon className="h-4 w-4" />
                Refresh
              </button>
            </div>
          )}
        </div>

        <p className="mt-4 text-xs text-gray-500">
          Tip: Edit the order confirmation text under WhatsApp → Message templates (key:{' '}
          <code className="rounded bg-gray-100 px-1">order_confirmed</code>).
        </p>
      </div>
    </div>
  );
};

export default WhatsAppWebConnect;
