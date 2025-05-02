import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const WhatsAppSettings: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">WhatsApp Integration</h1>
          <p className="text-gray-600 mt-2">
            Send order updates to customers via WhatsApp.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">How It Works</h2>
              
              <div className="p-4 mb-4 bg-green-50 rounded-md text-sm text-green-700">
                <p className="font-semibold mb-1">Direct WhatsApp Links</p>
                <p>
                  This integration uses direct WhatsApp links to open the WhatsApp app or web interface
                  with a pre-filled message for your customer.
                </p>
              </div>
              
              <div className="space-y-4 text-sm text-gray-700">
                <div>
                  <h3 className="font-medium text-gray-900">Simple Order Confirmation</h3>
                  <p>When viewing an order, click "Send WhatsApp Message" to generate a confirmation message using this template:</p>
                  <div className="mt-2 p-3 bg-gray-50 rounded-md whitespace-pre-wrap text-gray-700">
{`Hello [Customer Name]✨
OCD Crochet here, your order [Order Number] is confirmed! 

Since every piece is handmade by one person, delivery may take around 2 weeks. 

Thank you for your patience!
Please kindly confirm 🤍`}
                  </div>
                </div>

                <div>
                  <h3 className="font-medium text-gray-900">Usage Guidelines</h3>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Use WhatsApp for personalized order confirmations and updates</li>
                    <li>Be respectful of customer privacy and only contact them about their orders</li>
                    <li>Avoid sending marketing messages or spam</li>
                    <li>Respond promptly to customer inquiries received via WhatsApp</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-medium text-gray-900">Benefits</h3>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Direct, personal communication with customers</li>
                    <li>Higher response rates compared to email</li>
                    <li>Build stronger relationships with your customers</li>
                    <li>No technical setup or API integrations required</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppSettings; 