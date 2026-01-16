import React, { useState, useRef, useEffect } from 'react'

const MediaDisplay = ({ type = 'image', src, alt = 'Media', autoPlay = false, controls = true, poster = null }) => {
    const [isHovering, setIsHovering] = useState(false)
    const videoRef = useRef(null)

    // Remove /api from base URL if present since uploads are served directly
    const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
    const assetsBase = baseUrl.replace('/api', '') || baseUrl
    const getMediaUrl = (mediaSrc) => {
        if (!mediaSrc) return ''
        if (mediaSrc.startsWith('http://') || mediaSrc.startsWith('https://')) {
            return mediaSrc
        }
        return `${assetsBase}/uploads/${mediaSrc}`
    }

    // Auto-play/pause video on hover
    useEffect(() => {
        if (videoRef.current) {
            if (isHovering && autoPlay) {
                videoRef.current.play().catch(err => console.log('Video play failed:', err))
            } else {
                videoRef.current.pause()
                videoRef.current.currentTime = 0
            }
        }
    }, [isHovering, autoPlay])

    if (type === 'video' && src) {
        return (
            <div 
                className="media-display media-video"
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
            >
                <video
                    ref={videoRef}
                    src={getMediaUrl(src)}
                    alt={alt}
                    controls={controls}
                    poster={poster ? getMediaUrl(poster) : undefined}
                    className="video-player"
                />
            </div>
        )
    }

    // Default to image
    return (
        <div className="media-display media-image">
            <img 
                src={getMediaUrl(src)}
                alt={alt}
                className="post-image"
            />
        </div>
    )
}

export default MediaDisplay
