'use client'

import React, { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ExternalLink,
  FileImage,
  Globe,
  ImageUp,
  Instagram,
  Link as LinkIcon,
  Loader2,
  Phone,
  Send,
  Store,
  User,
  X,
} from 'lucide-react'
import { COMMON_ASSETS } from '@/constants'

const SUPPLIER_TYPES = [
  { value: 'cakes', label: 'Cakes & Desserts' },
  { value: 'photo_video', label: 'Photo & Video' },
  { value: 'catering', label: 'Catering' },
  { value: 'hosting', label: 'Host / Emcee' },
  { value: 'band_music', label: 'Band / DJ / Music' },
  { value: 'coordinator', label: 'Event Coordinator / Planner' },
  { value: 'styling_decor', label: 'Styling & Decor' },
  { value: 'flowers', label: 'Flowers & Bouquets' },
  { value: 'lights_sounds', label: 'Lights & Sounds' },
  { value: 'venue', label: 'Venue / Event Space' },
  { value: 'rentals', label: 'Tables, Chairs & Party Rentals' },
  { value: 'mobile_bar', label: 'Mobile Bar / Coffee Cart' },
  { value: 'entertainment', label: 'Magician / Performer / Entertainment' },
  { value: 'hair_makeup', label: 'Hair & Makeup' },
  { value: 'invites_souvenirs', label: 'Invitations, Giveaways & Souvenirs' },
  { value: 'transportation', label: 'Transport / Bridal Car' },
  { value: 'other', label: 'Other Event Service' },
] as const

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-400'

function normalizeUrl(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

export default function SupplierSignupClient() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [contactNumber, setContactNumber] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [description, setDescription] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [facebookPage, setFacebookPage] = useState('')
  const [website, setWebsite] = useState('')
  const [extraLink, setExtraLink] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showThanks, setShowThanks] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')

  useEffect(() => {
    if (!image) {
      setPreviewUrl('')
      return
    }

    const objectUrl = URL.createObjectURL(image)
    setPreviewUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [image])

  const clearForm = () => {
    setName('')
    setContactNumber('')
    setBusinessName('')
    setDescription('')
    setBusinessType('')
    setFacebookPage('')
    setWebsite('')
    setExtraLink('')
    setImage(null)
    setError('')
  }

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setError('')
    const selectedFile = event.target.files?.[0] ?? null
    if (!selectedFile) {
      setImage(null)
      return
    }

    if (!selectedFile.type.startsWith('image/')) {
      setError('Please upload an image file.')
      event.target.value = ''
      return
    }

    if (selectedFile.size > 8 * 1024 * 1024) {
      setError('Please upload an image below 8 MB.')
      event.target.value = ''
      return
    }

    setImage(selectedFile)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    if (!name.trim() || !contactNumber.trim() || !businessName.trim() || !description.trim() || !businessType) {
      setError('Please fill in your name, contact number, business name, description, and business type.')
      return
    }

    setIsSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('name', name)
      formData.append('contactNumber', contactNumber)
      formData.append('businessName', businessName)
      formData.append('description', description)
      formData.append('businessType', businessType)
      formData.append('facebookPage', normalizeUrl(facebookPage))
      formData.append('website', normalizeUrl(website))
      formData.append('extraLink', normalizeUrl(extraLink))
      if (image) {
        formData.append('image', image)
      }

      const response = await fetch('/api/supplier-signups', {
        method: 'POST',
        body: formData,
      })
      const payload = await response.json()

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Unable to send your signup right now.')
      }

      clearForm()
      setShowThanks(true)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to send your signup right now.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col genie-page-bg">
      <header className="sticky top-0 z-40 border-b border-purple-100/60 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/suppliers')}
              className="rounded-full p-2 text-slate-600 transition-colors hover:bg-purple-50 hover:text-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-400"
              aria-label="Back to suppliers"
            >
              <ArrowLeft size={20} />
            </button>
            <Link href="/" className="flex items-center gap-2">
              <img src={COMMON_ASSETS.logo} alt="Genie.ph Logo" className="h-8 w-auto object-contain" />
            </Link>
          </div>
          <Link
            href="/suppliers"
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 transition-colors hover:border-purple-200 hover:text-purple-700"
          >
            <BriefcaseBusiness size={16} />
            Directory
          </Link>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[0.86fr_1.14fr] lg:px-8 lg:py-12">
        <section className="space-y-6">
          <div>
            <h1 className="text-3xl font-black leading-tight tracking-tight text-slate-950 sm:text-4xl">
              List your business to get more customers
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
              Share your business details and reach more people planning Cebu celebrations.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-lg border border-slate-200 bg-white/75 p-4 shadow-sm">
              <Store className="mb-3 text-purple-600" size={22} />
              <h2 className="text-sm font-bold text-slate-900">Built for local event businesses</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Cakes, catering, coordination, photo and video, entertainment, rentals, and celebration add-ons are all welcome.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white/80 p-5 shadow-lg backdrop-blur sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="supplier-name" className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Your name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-3.5 text-slate-400" size={17} />
                  <input
                    id="supplier-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className={`${inputClass} pl-10`}
                    autoComplete="name"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="supplier-contact" className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Contact number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-3.5 text-slate-400" size={17} />
                  <input
                    id="supplier-contact"
                    type="tel"
                    value={contactNumber}
                    onChange={(event) => setContactNumber(event.target.value)}
                    className={`${inputClass} pl-10`}
                    autoComplete="tel"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="business-name" className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Business name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Building2 className="pointer-events-none absolute left-3 top-3.5 text-slate-400" size={17} />
                  <input
                    id="business-name"
                    value={businessName}
                    onChange={(event) => setBusinessName(event.target.value)}
                    className={`${inputClass} pl-10`}
                    autoComplete="organization"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="business-type" className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Business type <span className="text-red-500">*</span>
                </label>
                <select
                  id="business-type"
                  value={businessType}
                  onChange={(event) => setBusinessType(event.target.value)}
                  className={inputClass}
                  required
                >
                  <option value="">Select a service</option>
                  {SUPPLIER_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="business-description" className="mb-1.5 block text-sm font-semibold text-slate-700">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                id="business-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className={inputClass}
                rows={4}
                placeholder="Tell us what you offer, your service area, package style, and what events you usually handle."
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="facebook-page" className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Facebook page
                </label>
                <div className="relative">
                  <Instagram className="pointer-events-none absolute left-3 top-3.5 text-slate-400" size={17} />
                  <input
                    id="facebook-page"
                    type="text"
                    value={facebookPage}
                    onChange={(event) => setFacebookPage(event.target.value)}
                    className={`${inputClass} pl-10`}
                    placeholder="facebook.com/..."
                  />
                </div>
              </div>

              <div>
                <label htmlFor="supplier-website" className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Website
                </label>
                <div className="relative">
                  <Globe className="pointer-events-none absolute left-3 top-3.5 text-slate-400" size={17} />
                  <input
                    id="supplier-website"
                    type="text"
                    value={website}
                    onChange={(event) => setWebsite(event.target.value)}
                    className={`${inputClass} pl-10`}
                    placeholder="yourbusiness.com"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="supplier-link" className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Other link
                </label>
                <div className="relative">
                  <LinkIcon className="pointer-events-none absolute left-3 top-3.5 text-slate-400" size={17} />
                  <input
                    id="supplier-link"
                    type="text"
                    value={extraLink}
                    onChange={(event) => setExtraLink(event.target.value)}
                    className={`${inputClass} pl-10`}
                    placeholder="Menu, portfolio, IG..."
                  />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="supplier-image" className="mb-1.5 block text-sm font-semibold text-slate-700">
                Upload image
              </label>
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <label
                    htmlFor="supplier-image"
                    className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
                  >
                    <ImageUp size={17} />
                    Choose image
                  </label>
                  <input id="supplier-image" type="file" accept="image/*" onChange={handleImageChange} className="sr-only" />
                  <div className="min-w-0 text-sm text-slate-600">
                    {image ? (
                      <div className="flex items-center gap-2">
                        <FileImage size={16} className="shrink-0 text-purple-600" />
                        <span className="truncate">{image.name}</span>
                        <button
                          type="button"
                          onClick={() => setImage(null)}
                          className="rounded-full p-1 text-slate-500 hover:bg-white hover:text-red-600"
                          aria-label="Remove selected image"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <span>Optional. Upload a logo, sample setup, product photo, or menu image.</span>
                    )}
                  </div>
                </div>
                {previewUrl && (
                  <img
                    src={previewUrl}
                    alt="Selected supplier upload preview"
                    className="mt-4 h-36 w-full rounded-lg object-cover sm:w-56"
                  />
                )}
              </div>
            </div>

            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="genie-btn-primary inline-flex w-full items-center justify-center rounded-lg px-5 py-3.5 text-sm font-bold transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-5 w-5" />}
              {isSubmitting ? 'Sending application...' : 'Send supplier signup'}
            </button>
          </form>
        </section>
      </main>

      {showThanks && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="supplier-thanks-title"
            className="w-full max-w-md rounded-lg bg-white p-6 text-center shadow-2xl"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={30} />
            </div>
            <h2 id="supplier-thanks-title" className="mt-4 text-2xl font-black text-slate-950">
              Thank you!
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Your supplier signup was sent. We will list your business soon so website visitors can discover your services.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setShowThanks(false)}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-3 text-sm font-bold text-slate-800 hover:bg-slate-50"
              >
                Add another
              </button>
              <Link
                href="/suppliers"
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800"
              >
                View directory
                <ExternalLink size={15} />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
