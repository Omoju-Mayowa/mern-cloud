import React, { useState, useEffect, useRef } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import axios from 'axios'
import Posts from './components/Posts'
import MediaDisplay from './components/MediaDisplay'
import LikeButton from './components/LikeButton'
import usePostStream from './components/usePostStream'
import ReactTimeAgo from 'react-time-ago'
import TimeAgo from 'javascript-time-ago'
import en from 'javascript-time-ago/locale/en.json'
import ru from 'javascript-time-ago/locale/ru.json'
import Loader from './components/Loader'

TimeAgo.addDefaultLocale(en)
TimeAgo.addLocale(ru)

const scrollTop = () => {
  window.scrollTo(0, 0);
}

const Search = () => {
    const [searchParams, setSearchParams] = useSearchParams()
    const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '')
    const [results, setResults] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [currentPage, setCurrentPage] = useState(1)
    const resultsPerPage = 10
    const searchInputRef = useRef(null)
    const debounceTimer = useRef(null)

    // SSE subscription for real-time updates
    usePostStream((event, payload) => {
        if (event === 'post_created' || event === 'post_updated' || event === 'post_deleted') {
            // Re-fetch results to get updated data
            if (searchQuery.trim()) {
                handleSearch(searchQuery)
            }
        } else if (event === 'post_liked') {
            // Update likes count in real-time without refetching
            setResults(prev => prev.map(p => 
                (String(p._id) === String(payload.postId) ? { ...p, likesCount: payload.likesCount } : p)
            ))
        }
    })

    const handleSearch = async (query) => {
        if (!query.trim()) {
            setResults([])
            setError('')
            return
        }

        setLoading(true)
        setError('')
        setCurrentPage(1)

        try {
            const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/posts`)
            const allPosts = response.data

            // Fetch author names and avatars for posts where creator is just an ID
            const postsWithAuthors = await Promise.all(
                allPosts.map(async (post) => {
                    if (post.creator && typeof post.creator === 'object' && post.creator.name) {
                        // Already populated
                        return post
                    } else if (post.creator) {
                        // Need to fetch author
                        try {
                            const authorId = typeof post.creator === 'object' ? post.creator._id : post.creator
                            const authorResponse = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/users/${authorId}`)
                            return {
                                ...post,
                                creator: {
                                    _id: authorId,
                                    name: authorResponse.data.name || 'Unknown',
                                    avatar: authorResponse.data.avatar || 'avatar-default.png'
                                }
                            }
                        } catch (err) {
                            return {
                                ...post,
                                creator: {
                                    _id: post.creator,
                                    name: 'Unknown',
                                    avatar: 'avatar-default.png'
                                }
                            }
                        }
                    }
                    return post
                })
            )

            // Filter posts by search query (title, description, category, author)
            const filtered = postsWithAuthors.filter(post => {
                const searchLower = query.toLowerCase()
                const titleMatch = post.title?.toLowerCase().includes(searchLower) || false
                const descriptionMatch = post.description?.toLowerCase().includes(searchLower) || false
                const categoryMatch = post.category?.toLowerCase().includes(searchLower) || false
                const authorName = post.creator?.name || (typeof post.creator === 'object' ? post.creator?.name : '')
                const authorMatch = authorName.toLowerCase().includes(searchLower) || false

                return titleMatch || descriptionMatch || categoryMatch || authorMatch
            })

            setResults(filtered)

            if (filtered.length === 0) {
                setError('No posts found matching your search.')
            }
        } catch (err) {
            setError('Failed to search posts. Please try again.')
            console.error('Search error:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleSearchChange = (e) => {
        const query = e.target.value
        setSearchQuery(query)
        setSearchParams(query ? { q: query } : {})
        setCurrentPage(1) // Reset to first page on new search
        
        // Clear previous debounce timer
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current)
        }
        
        // Debounce search - wait 300ms after user stops typing
        debounceTimer.current = setTimeout(() => {
            if (query.trim()) {
                handleSearch(query)
            } else {
                setResults([])
                setError('')
            }
        }, 300)
    }

    const handleSearchSubmit = (e) => {
        e.preventDefault()
        // Clear debounce and search immediately
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current)
        }
        if (searchQuery.trim()) {
            handleSearch(searchQuery)
        }
    }

    // Perform search when component mounts with initial query
    useEffect(() => {
        if (searchQuery.trim()) {
            handleSearch(searchQuery)
        }
        
        // Cleanup debounce timer on unmount
        return () => {
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current)
            }
        }
    }, [])

    // Pagination
    const indexOfLastPost = currentPage * resultsPerPage
    const indexOfFirstPost = indexOfLastPost - resultsPerPage
    const currentPosts = results.slice(indexOfFirstPost, indexOfLastPost)
    const totalPages = Math.ceil(results.length / resultsPerPage)

    return (
        <section className="posts">
            <div className="container">
                <h2>Search Blog Posts</h2>
                
                <form onSubmit={handleSearchSubmit} className="form login__form">
                    {error && <p className="form__error-message">{error}</p>}
                    <input
                        type="text"
                        placeholder="Search by title, content, category, or author..."
                        value={searchQuery}
                        onChange={handleSearchChange}
                        ref={searchInputRef}
                        autoFocus
                    />
                </form>

                {loading && (
                    <Loader size='small' />
                )}

                {!loading && results.length > 0 && (
                    <div>
                        <p className="center" style={{marginTop: '2rem', marginBottom: '1rem'}}>
                            Found {results.length} result{results.length !== 1 ? 's' : ''}
                        </p>
                        
                        <div className="container posts__container">
                            {currentPosts.map(post => {
                                const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
                                const assetsBase = baseUrl.replace('/api', '') || baseUrl
                                const hasVideo = post.videoUrl && post.videoUrl.trim() !== ''
                                const hasThumbnail = post.thumbnail && post.thumbnail.trim() !== '' && post.thumbnail !== 'default-avatar.png' && post.thumbnail !== 'video-placeholder.png'
                                const authorAvatar = post.creator?.avatar || 'avatar-default.png'
                                const authorAvatarUrl = (authorAvatar.startsWith && (authorAvatar.startsWith('http://') || authorAvatar.startsWith('https://'))) ? authorAvatar : `${assetsBase}/uploads/${authorAvatar}`
                                
                                return (
                                <article key={post._id} className="post">
                                    <div className="post__thumbnail">
                                        {hasVideo && hasThumbnail ? (
                                            <MediaDisplay 
                                                type="video" 
                                                src={post.videoUrl} 
                                                alt={post.title} 
                                                autoPlay={true} 
                                                controls={false} 
                                                poster={post.thumbnail}
                                            />
                                        ) : hasThumbnail ? (
                                            <MediaDisplay 
                                                type="image" 
                                                src={post.thumbnail} 
                                                alt={post.title} 
                                            />
                                        ) : hasVideo ? (
                                            <MediaDisplay 
                                                type="video" 
                                                src={post.videoUrl} 
                                                alt={post.title} 
                                                autoPlay={true} 
                                                controls={false} 
                                            />
                                        ) : (
                                            <img src={`${assetsBase}/uploads/default-avatar.png`} alt={post.title} />
                                        )}
                                    </div>
                                    <div className="post__content">
                                        <Link to={`/posts/${post._id}`} onClick={scrollTop}>
                                            <h3>{post.title.length > 60 ? post.title.substr(0, 60) + '...' : post.title}</h3>
                                            <p>{post.description.replace(/<[^>]*>/g, '').substr(0, 145)}...</p>
                                        </Link>
                                        <div className="post__footer">
                                            <Link 
                                                to={`/profile/${post.creator?._id || post.creator}`} 
                                                className='post__author'
                                                onClick={scrollTop}
                                            >
                                                <div className="post__author-avatar">
                                                    <img 
                                                        src={authorAvatarUrl}
                                                        alt={post.creator?.name || 'Unknown'}
                                                        onError={(e) => { e.target.src = `${assetsBase}/uploads/avatar-default.png` }}
                                                    />
                                                </div>
                                                <div className="post__author-details">
                                                    <h5>By: {post.creator?.name || 'Unknown'}</h5>
                                                    <small><ReactTimeAgo date={new Date(post.createdAt)} locale='en-US' /></small>
                                                </div>
                                            </Link>
                                            <span>
                                                <LikeButton postID={post._id} initialLikesCount={post.likesCount} initialLikedBy={post.likedBy} />
                                                <Link className='btn category' to={`/posts/categories/${post.category}`} onClick={scrollTop}>
                                                  {post.category && post.category.length > 12 ? post.category.substring(0, 12) + '...' : post.category}
                                                </Link>
                                            </span>
                                        </div>
                                    </div>
                                </article>
                                )
                            })}
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="pagination">
                                <button 
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                    className="btn pagination__btn"
                                >
                                    Previous
                                </button>
                                <span className="pagination__info">
                                    Page {currentPage} of {totalPages}
                                </span>
                                <button 
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage === totalPages}
                                    className="btn pagination__btn"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {!loading && results.length === 0 && searchQuery && !error && (
                    <div className="center" style={{marginTop: '2rem'}}>
                        <p>No posts found. Try a different search term.</p>
                    </div>
                )}

                {!loading && !searchQuery && (
                    <div className="center" style={{marginTop: '2rem'}}>
                        <p>Enter a search term to find blog posts.</p>
                    </div>
                )}
            </div>
        </section>
    )
}

export default Search
