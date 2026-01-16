import React, { useState, useContext, useEffect } from 'react'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'
import { useNavigate } from 'react-router-dom'

import { UserContext } from './components/context/userContext'
import axios from 'axios'


const scrollTop = () => {
  window.scrollTo(0, 0);
}

const CreatePost = () => {
  const [title, setTitle] = useState('')
  const [category, setcategory] = useState('')
  const [categoryInput, setCategoryInput] = useState('')
  const [description, setDescription] = useState('')
  const [videoFile, setVideoFile] = useState(null)
  const [thumbnail, setThumbnail] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [categories, setCategories] = useState([])
  const [loadingCategories, setLoadingCategories] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const navigate = useNavigate()

  const {currentUser} = useContext(UserContext)
  const token = currentUser?.token

  // Count words
  const countWords = (text) => {
    return text.trim().split(/\s+/).filter(w => w.length > 0).length
  }

  const titleWords = countWords(title)
  const descriptionWords = countWords(description.replace(/<[^>]*>/g, ''))
  const TITLE_LIMIT = 12000
  const DESCRIPTION_LIMIT = 50000

  // Fetch categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      setLoadingCategories(true)
      try {
        const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/categories`)
        const cats = res.data || []
        setCategories(cats)
      } catch (err) {
        console.error('Failed to fetch categories', err)
        setCategories([])
      } finally {
        setLoadingCategories(false)
      }
    }

    fetchCategories()
  }, [])

  //redirect to login page for users who haven't logged in
  useEffect(() => {
    if(!token) {
      navigate('/login')
    }
  }, [])

  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      ['bold', 'italic', 'underline', 'strike', 'blockquote'],
      [{'list': 'ordered'}, {'list': 'bullet'}, {'indent': '-1'}, {'indent': '+1'}],
      ['link', 'image'],
      ['clean']
    ],
  }

  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike', 'blockquote',
    'list', 'bullet', 'indent',
    'link', 'image'
  ]

  // Filter categories based on input
  const filteredCategories = categories.filter(cat => 
    cat.name.toLowerCase().includes(categoryInput.toLowerCase())
  )

  const handleCategorySelect = (catName) => {
    setcategory(catName)
    setCategoryInput(catName)
    setShowSuggestions(false)
  }

  const handleCategoryInputChange = (e) => {
    const val = e.target.value
    setCategoryInput(val)
    setcategory(val)
    setShowSuggestions(val.length > 0)
  }

  const submitPost = async (e) => {
    e.preventDefault()
    setError('')
    
    if (!token) return navigate('/login')
    if (!title.trim()) {
      setError('Title is required')
      return
    }
    if (titleWords > TITLE_LIMIT) {
      setError(`Title exceeds ${TITLE_LIMIT} word limit (${titleWords} words)`)
      return
    }
    if (!categoryInput.trim()) {
      setError('Category is required')
      return
    }
    if (!description || description === '<p><br></p>') {
      setError('Description is required')
      return
    }
    if (descriptionWords > DESCRIPTION_LIMIT) {
      setError(`Description exceeds ${DESCRIPTION_LIMIT} word limit (${descriptionWords} words)`)
      return
    }
    if (!thumbnail && !videoFile) {
      setError('Please provide either a thumbnail/image or a video')
      return
    }

    setIsLoading(true)

    try {
      // Check if category exists, if not create it
      const catExists = categories.some(c => c.name.toLowerCase() === categoryInput.toLowerCase())
      if (!catExists) {
        try {
          await axios.post(`${import.meta.env.VITE_API_BASE_URL}/categories`, { name: categoryInput }, {
            headers: { Authorization: `Bearer ${token}` }
          })
          console.log('Category created:', categoryInput)
        } catch (catErr) {
          if (catErr.response?.status !== 409) {
            console.warn('Failed to create category:', catErr.response?.data || catErr.message)
          }
        }
      }

      // Create post
      const form = new FormData()
      form.append('title', title.trim())
      form.append('category', categoryInput)
      form.append('description', description)
      if (thumbnail) form.append('thumbnail', thumbnail)
      if (videoFile) form.append('video', videoFile)

      const res = await axios.post(`${import.meta.env.VITE_API_BASE_URL}/posts`, form, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`
        }
      })
      const created = res.data
      navigate(`/posts/${created._id || created.id}`)
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to create post'
      setError(errorMsg)
      console.error('Create post failed', err.response?.data || err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section className="create-post">
      <div className="container">
        <h2>Create Post</h2>
        {error && <p className="form__error-message">{error}</p>}
        <form className="form create-post__form" onSubmit={submitPost}>
          <input 
            type="text" 
            placeholder='Title' 
            value={title} 
            onChange={e => setTitle(e.target.value)} 
            autoFocus 
          />
          <small style={{ color: titleWords > TITLE_LIMIT ? '#d32f2f' : '#666' }}>
            Words: {titleWords} / {TITLE_LIMIT}
          </small>
          
          {/* Searchable Category Input */}
          <div style={{ position: 'relative' }}>
            <input 
              type="text" 
              placeholder='Category (search or type new)' 
              value={categoryInput} 
              onChange={handleCategoryInputChange}
              onFocus={() => categoryInput.length > 0 && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              autoComplete="off"
            />
            {showSuggestions && filteredCategories.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                backgroundColor: '#fff',
                border: '1px solid #ddd',
                borderTop: 'none',
                maxHeight: '200px',
                overflowY: 'auto',
                zIndex: 10
              }}>
                {filteredCategories.map(cat => (
                  <div
                    key={cat._id}
                    onClick={() => handleCategorySelect(cat.name)}
                    style={{
                      padding: '10px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #eee',
                      hover: { backgroundColor: '#f5f5f5' }
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = '#fff'}
                  >
                    {cat.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          <ReactQuill modules={modules} formats={formats} value={description} onChange={setDescription} />
          <small style={{ color: descriptionWords > DESCRIPTION_LIMIT ? '#d32f2f' : '#666' }}>
            Words: {descriptionWords} / {DESCRIPTION_LIMIT}
          </small>

          <label>Thumbnail/Image (optional - provide this or video)</label>
          <input type="file" onChange={e => setThumbnail(e.target.files[0])} accept='image/png, image/jpg, image/jpeg, image/webp' />

          <label>Video (optional - provide this or thumbnail)</label>
          <input type="file" onChange={e => setVideoFile(e.target.files[0])} accept='video/mp4, video/webm, video/ogg' />

          <button type='submit' onClick={scrollTop} className='btn primary' disabled={isLoading}>{isLoading ? 'Creating...' : 'Create'}</button>
        </form>
      </div>
    </section>
  )
}

export default CreatePost