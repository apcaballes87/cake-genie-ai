import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';

interface ContactPageProps {
  onClose: () => void;
}

const ContactPage: React.FC<ContactPageProps> = ({ onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    contactNumber: '',
    email: '',
    comment: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Form submission logic would go here
    console.log('Form submitted:', formData);
    alert('Thank you for your message! We will get back to you soon.');
    // Reset form
    setFormData({
      name: '',
      contactNumber: '',
      email: '',
      comment: ''
    });
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-white/70 backdrop-blur-lg p-8 rounded-2xl shadow-lg border border-slate-200 animate-fade-in">
      <style>{`.animate-fade-in { animation: fadeIn 0.3s ease-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors" aria-label="Go back">
          <ArrowLeft />
        </button>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text">Contact Us</h1>
      </div>
      
      <div className="space-y-8">
        <section>
          <h2 className="text-2xl font-bold mb-6 text-slate-800 border-l-4 border-pink-500 pl-3">Get In Touch</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-700">Contact Information</h3>
                <ul className="mt-2 space-y-2 text-slate-600">
                  <li><span className="font-medium">Website:</span> genie.ph</li>
                  <li><span className="font-medium">Email:</span> support@genie.ph</li>
                  <li><span className="font-medium">Contact:</span> 0908 940 8747</li>
                  <li><span className="font-medium">Address:</span> Skyview Park, Nivel Hills, Cebu City</li>
                </ul>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200">
              <h3 className="text-lg font-semibold text-slate-700 mb-4">Business Hours</h3>
              <p className="text-slate-600">Monday - Sunday: 9:00 AM - 9:00 PM</p>
              <p className="text-slate-600 mt-2">Orders are processed during business hours.</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-6 text-slate-800 border-l-4 border-purple-500 pl-3">Leave Your Details</h2>
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                  placeholder="Your full name"
                />
              </div>
              
              <div>
                <label htmlFor="contactNumber" className="block text-sm font-medium text-slate-700 mb-1">Contact Number *</label>
                <input
                  type="tel"
                  id="contactNumber"
                  name="contactNumber"
                  value={formData.contactNumber}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                  placeholder="Your phone number"
                />
              </div>
              
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                  placeholder="your.email@example.com"
                />
              </div>
            </div>
            
            <div className="mt-6">
              <label htmlFor="comment" className="block text-sm font-medium text-slate-700 mb-1">Comment *</label>
              <textarea
                id="comment"
                name="comment"
                value={formData.comment}
                onChange={handleChange}
                required
                rows={4}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                placeholder="How can we help you?"
              ></textarea>
            </div>
            
            <div className="mt-6">
              <button
                type="submit"
                className="w-full md:w-auto px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
              >
                Submit Message
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
};

export default ContactPage;