import React, { useState, useEffect, useRef } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import axios from 'axios'
import MediaDisplay from './components/MediaDisplay'
import LikeButton from './components/LikeButton'
import usePostStream from './components/usePostStream'
import ReactTimeAgo from 'react-time-ago'
import TimeAgo from 'javascript-time-ago'
import en from 'javascript-time-ago/locale/en.json'
import Loader from './components/Loader'

TimeAgo.addDefaultLocale(en)

const scrollTop = () => window.scrollTo(0, 0);

const Search = () => {
    const [searchParams, setSearchParams] = useSearchParams()
    const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '')
    const [results, setResults] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [currentPage, setCurrentPage] = useState(1)
    const resultsPerPage = 10
    const debounceTimer = useRef(null)

    const assetsBase = import.meta.env.VITE_API_ASSETS_URL || 'https://pub-ec6d8fbb35c24f83a77c02047b5c8f13.r2.dev';

    // Helper to resolve URLs consistently
    const resolveUrl = (fileName) => {
        // If no filename, use a generic post placeholder (not an avatar)
        if (!fileName || fileName.includes('default')) {
            return `${assetsBase}/mern/post-placeholder.png`; 
        }
        return fileName.startsWith('http') ? fileName : `${assetsBase}/mern/${fileName}`;
    }
    
    usePostStream((event, payload) => {
        if (['post_created', 'post_updated', 'post_deleted'].includes(event)) {
            if (searchQuery.trim()) handleSearch(searchQuery);
        } else if (event === 'post_liked') {
            setResults(prev => prev.map(p => 
                (String(p._id) === String(payload.postId) ? { ...p, likesCount: payload.likesCount } : p)
            ))
        }
    })

    const handleSearch = async (query) => {
        if (!query.trim()) { setResults([]); return; }
        setLoading(true);
        setError('');
        try {
            const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/posts`)
            const allPosts = response.data
            
            // Populating authors and filtering
            const filtered = allPosts.filter(post => {
                const searchLower = query.toLowerCase()
                const authorName = post.creator?.name || '';
                return post.title?.toLowerCase().includes(searchLower) || 
                       post.description?.toLowerCase().includes(searchLower) || 
                       post.category?.toLowerCase().includes(searchLower) ||
                       authorName.toLowerCase().includes(searchLower)
            })

            setResults(filtered)
            if (filtered.length === 0) setError('No posts found matching your search.')
        } catch (err) {
            setError('Failed to search posts.')
        } finally { setLoading(false) }
    }

    const handleSearchChange = (e) => {
        const query = e.target.value
        setSearchQuery(query)
        setSearchParams(query ? { q: query } : {})
        if (debounceTimer.current) clearTimeout(debounceTimer.current)
        debounceTimer.current = setTimeout(() => handleSearch(query), 300)
    }

    const indexOfLastPost = currentPage * resultsPerPage
    const indexOfFirstPost = indexOfLastPost - resultsPerPage
    const currentPosts = results.slice(indexOfFirstPost, indexOfLastPost)
    const totalPages = Math.ceil(results.length / resultsPerPage)

    return (
        <section className="posts">
            <div className="container">
                <h2>Search Blog Posts</h2>
                <form onSubmit={(e) => e.preventDefault()} className="form login__form">
                    <input
                        type="text"
                        placeholder="Search by title, category, or author..."
                        value={searchQuery}
                        onChange={handleSearchChange}
                        autoFocus
                    />
                </form>

                {loading ? <Loader size='small' /> : (
                    results.length > 0 && (
                        <div>
                            <p className="center" style={{margin: '2rem 0'}}>Found {results.length} results</p>
                            <div className="container posts__container">
                                {currentPosts.map(post => (
                                    <article key={post._id} className="post">
                                        <div className="post__thumbnail">
                                            <MediaDisplay 
                                                type={post.videoUrl ? "video" : "image"} 
                                                src={post.videoUrl || resolveUrl(post.thumbnail)} 
                                                poster={resolveUrl(post.thumbnail)}
                                                alt={post.title} 
                                            />
                                        </div>
                                        <div className="post__content">
                                            <Link to={`/posts/${post._id}`} onClick={scrollTop}>
                                                <h3>{post.title}</h3>
                                                <p>{post.description.replace(/<[^>]*>/g, '').substr(0, 145)}...</p>
                                            </Link>
                                            <div className="post__footer">
                                                <Link to={`/profile/${post.creator?._id}`} className='post__author'>
                                                    <div className="post__author-avatar">
                                                        <img src={resolveUrl(post.creator?.avatar)} alt="" onError={e => e.target.src = resolveUrl()}/>
                                                    </div>
                                                    <div className="post__author-details">
                                                        <h5>By: {post.creator?.name}</h5>
                                                        <small><ReactTimeAgo date={new Date(post.createdAt)} locale='en-US' /></small>
                                                    </div>
                                                </Link>
                                                <span>
                                                    <LikeButton postID={post._id} initialLikesCount={post.likesCount} />
                                                    <Link className='btn category' to={`/posts/categories/${post.category}`}>{post.category}</Link>
                                                </span>
                                            </div>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        </div>
                    )
                )}
            </div>
        </section>
    )
}

export default Search
