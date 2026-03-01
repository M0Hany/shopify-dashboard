import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

export interface WhatsAppMessageTemplate {
  id: string;
  key: string;
  name: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export class WhatsAppTemplateService {
  async getAll(): Promise<WhatsAppMessageTemplate[]> {
    const { data, error } = await supabase
      .from('whatsapp_message_templates')
      .select('*')
      .order('key', { ascending: true });

    if (error) {
      logger.error('Error fetching WhatsApp templates', { error });
      throw error;
    }
    return data || [];
  }

  async getByKey(key: string): Promise<WhatsAppMessageTemplate | null> {
    const { data, error } = await supabase
      .from('whatsapp_message_templates')
      .select('*')
      .eq('key', key)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      logger.error('Error fetching WhatsApp template by key', { key, error });
      throw error;
    }
    return data;
  }

  async getById(id: string): Promise<WhatsAppMessageTemplate | null> {
    const { data, error } = await supabase
      .from('whatsapp_message_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      logger.error('Error fetching WhatsApp template by id', { id, error });
      throw error;
    }
    return data;
  }

  async create(input: { key: string; name: string; body: string }): Promise<WhatsAppMessageTemplate> {
    const { data, error } = await supabase
      .from('whatsapp_message_templates')
      .insert({ key: input.key, name: input.name, body: input.body })
      .select()
      .single();

    if (error) {
      logger.error('Error creating WhatsApp template', { key: input.key, error });
      throw error;
    }
    return data;
  }

  async update(id: string, input: { name?: string; body?: string }): Promise<WhatsAppMessageTemplate> {
    const updateData: { name?: string; body?: string } = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.body !== undefined) updateData.body = input.body;

    const { data, error } = await supabase
      .from('whatsapp_message_templates')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Error updating WhatsApp template', { id, error });
      throw error;
    }
    return data;
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('whatsapp_message_templates')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Error deleting WhatsApp template', { id, error });
      throw error;
    }
  }
}

export const whatsappTemplateService = new WhatsAppTemplateService();
