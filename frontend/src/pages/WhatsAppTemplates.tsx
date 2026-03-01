import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DocumentTextIcon,
  PencilIcon,
  TrashIcon,
  ArrowLeftIcon,
  ChatBubbleLeftIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { Dialog } from '@headlessui/react';

interface WhatsAppMessageTemplate {
  id: string;
  key: string;
  name: string;
  body: string;
  created_at: string;
  updated_at: string;
}

const API = import.meta.env.VITE_API_URL;

function getBodyPreview(body: string, maxLines = 2): string {
  const lines = body.split(/\r?\n/).filter(Boolean);
  const slice = lines.slice(0, maxLines).join(' ');
  return slice.length > 120 ? slice.slice(0, 120) + '…' : slice || 'No content';
}

const WhatsAppTemplates: React.FC = () => {
  const queryClient = useQueryClient();
  const [editingTemplate, setEditingTemplate] = useState<WhatsAppMessageTemplate | null>(null);
  const [editName, setEditName] = useState('');
  const [editBody, setEditBody] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newName, setNewName] = useState('');
  const [newBody, setNewBody] = useState('');

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['whatsapp-templates'],
    queryFn: async () => {
      const res = await fetch(`${API}/api/whatsapp/templates`);
      if (!res.ok) throw new Error('Failed to fetch templates');
      const json = await res.json();
      return json.templates as WhatsAppMessageTemplate[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, name, body }: { id: string; name: string; body: string }) => {
      const res = await fetch(`${API}/api/whatsapp/templates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, body }),
      });
      if (!res.ok) throw new Error('Failed to update template');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-template'] });
      setEditingTemplate(null);
      toast.success('Template updated');
    },
    onError: () => toast.error('Failed to update template'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API}/api/whatsapp/templates/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete template');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-template'] });
      toast.success('Template deleted');
    },
    onError: () => toast.error('Failed to delete template'),
  });

  const createMutation = useMutation({
    mutationFn: async ({ key, name, body }: { key: string; name: string; body: string }) => {
      const res = await fetch(`${API}/api/whatsapp/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: key.trim(), name: name.trim(), body: body.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create template');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-template'] });
      setShowAddDialog(false);
      setNewKey('');
      setNewName('');
      setNewBody('');
      toast.success('Template added');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create template'),
  });

  const openEdit = (t: WhatsAppMessageTemplate) => {
    setEditingTemplate(t);
    setEditName(t.name);
    setEditBody(t.body);
  };

  const closeEdit = () => setEditingTemplate(null);

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplate) return;
    updateMutation.mutate({ id: editingTemplate.id, name: editName, body: editBody });
  };

  const handleDelete = (t: WhatsAppMessageTemplate) => {
    if (!window.confirm(`Delete template "${t.name}"? The app may fall back to default text if defined.`)) return;
    deleteMutation.mutate(t.id);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim() || !newName.trim() || !newBody.trim()) {
      toast.error('Key, name, and body are required');
      return;
    }
    createMutation.mutate({ key: newKey.trim(), name: newName.trim(), body: newBody.trim() });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-[calc(100vh-3.5rem)] bg-gray-50 overflow-hidden">
      {/* Header – match WhatsApp Inbox green bar */}
      <div className="flex-shrink-0 bg-gradient-to-r from-[#25D366] to-[#20BA5A] p-4 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/whatsapp"
              className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
              title="Back to Inbox"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <DocumentTextIcon className="w-6 h-6 text-white" />
              <h1 className="text-xl font-semibold text-white">Message templates</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAddDialog(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-white/20 hover:bg-white/30 rounded-full transition-colors"
              title="Add new template"
            >
              <PlusIcon className="w-5 h-5" />
              Add template
            </button>
            <Link
              to="/whatsapp"
              className="px-3 py-1.5 text-sm font-medium text-white bg-white/20 hover:bg-white/30 rounded-full transition-colors"
            >
              Inbox
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse"
              >
                <div className="h-5 bg-gray-200 rounded w-2/3 mb-2" />
                <div className="h-4 bg-gray-100 rounded w-1/2 mb-3" />
                <div className="h-12 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <ChatBubbleLeftIcon className="w-12 h-12 mb-3 text-gray-300" />
            <p className="text-sm">No templates yet. Add them in Supabase or run the seed SQL.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((t) => (
              <div
                key={t.id}
                className="bg-white rounded-lg border border-gray-200 transition-all duration-200 hover:border-gray-300 p-4 flex flex-col"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-base font-semibold text-gray-900 truncate flex-1">
                    {t.name}
                  </h3>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => openEdit(t)}
                      className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(t)}
                      className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mb-2 font-mono">{t.key}</p>
                <p className="text-sm text-gray-600 line-clamp-2 flex-1">
                  {getBodyPreview(t.body)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit modal */}
      <Dialog open={!!editingTemplate} onClose={closeEdit} className="relative z-50">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto w-full max-w-lg rounded-lg bg-white shadow-xl border border-gray-200 p-6">
            <Dialog.Title className="text-lg font-semibold text-gray-900 mb-4">
              Edit template
            </Dialog.Title>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message body</label>
                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={8}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  Placeholders: <code className="bg-gray-100 px-1 rounded">{'{{customer_first_name}}'}</code>
                  {', '}
                  <code className="bg-gray-100 px-1 rounded">{'{{items_list}}'}</code>
                  {' '}(for shipping confirmation only)
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeEdit}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-[#25D366] hover:bg-[#20BA5A] rounded-lg transition-colors disabled:opacity-50"
                >
                  {updateMutation.isPending ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* Add template modal */}
      <Dialog open={showAddDialog} onClose={() => setShowAddDialog(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto w-full max-w-lg rounded-lg bg-white shadow-xl border border-gray-200 p-6">
            <Dialog.Title className="text-lg font-semibold text-gray-900 mb-4">
              Add template
            </Dialog.Title>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Key (unique id, e.g. order_ready)</label>
                <input
                  type="text"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="e.g. order_ready"
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Order is ready"
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message body</label>
                <textarea
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  rows={8}
                  placeholder="Use {{customer_first_name}} and {{items_list}} as placeholders"
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  Placeholders: <code className="bg-gray-100 px-1 rounded">{'{{customer_first_name}}'}</code>
                  {', '}
                  <code className="bg-gray-100 px-1 rounded">{'{{items_list}}'}</code>
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddDialog(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-[#25D366] hover:bg-[#20BA5A] rounded-lg transition-colors disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Adding…' : 'Add template'}
                </button>
              </div>
            </form>
          </Dialog.Panel>
        </div>
      </Dialog>
    </div>
  );
};

export default WhatsAppTemplates;
