import React, { useState, useRef, useEffect } from 'react'

const MediaDisplay = ({ type = 'image', src, alt = 'Media', autoPlay = false, controls = true, poster = null, muted = false }) => {
    const [isHovering, setIsHovering] = useState(false)
    const videoRef = useRef(null)

    // Robust URL resolver: Fixes the mern/mern and uploads/ issues
    const getMediaUrl = (mediaSrc) => {
        if (!mediaSrc) return ''
        if (mediaSrc.startsWith('http')) return mediaSrc

        const assetsBase = import.meta.env.VITE_API_ASSETS_URL || 'https://pub-ec6d8fbb35c24f83a77c02047b5c8f13.r2.dev';

        // Check if path already contains a folder prefix to prevent doubling
        if (mediaSrc.startsWith('mern/') || mediaSrc.startsWith('uploads/')) {
            return `${assetsBase}/${mediaSrc}`
        }

        // Fallback to mern folder
        return `${assetsBase}/mern/${mediaSrc}`
    }

    // Auto-play/pause video on hover
    useEffect(() => {
        if (videoRef.current && type === 'video') {
            if (isHovering || autoPlay) {
                // If muted is false, this will throw "NotAllowedError" 
                // unless the user has interacted with the page first.
                videoRef.current.play().catch(err => {
                    console.warn('Playback blocked: Browsers require user interaction for non-muted video.', err)
                })
            } else {
                videoRef.current.pause()
                videoRef.current.currentTime = 0
            }
        }
    }, [isHovering, autoPlay, type])

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
                    muted={muted} // Set to false based on your request
                    playsInline={true} // Crucial for mobile and some desktop browsers
                    poster={poster ? getMediaUrl(poster) : undefined}
                    className="video-player"
                />
            </div>
        )
    }

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
