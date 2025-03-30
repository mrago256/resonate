import React, { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faStop, faUpload, faVolumeUp, faTachometerAlt } from '@fortawesome/free-solid-svg-icons';
import './App.css';

const App = () => {
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [words, setWords] = useState<any[]>([]);
    const [selectedWords, setSelectedWords] = useState<any[]>([]);
    const [isSelecting, setIsSelecting] = useState<boolean>(false);
    const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; width: number; height: number }>({ x: 0, y: 0, width: 0, height: 0 });
    const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
    const [speechSpeed, setSpeechSpeed] = useState<number>(1);
    const [volume, setVolume] = useState<number>(50);

    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const imageRef = useRef<HTMLImageElement | null>(null);
    const imageScale = useRef<number>(1);

    // Dynamically load the Tesseract.js script from CDN
    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
        script.async = true;
        script.onload = () => {
            console.log('Tesseract.js loaded!');
        };
        document.body.appendChild(script);

        return () => {
            document.body.removeChild(script);
        };
    }, []);

    const getSliderBackground = (min: number, max: number, value: number) => {
        const percent = ((value - min) / (max - min)) * 100;
        return `linear-gradient(to right,rgb(23, 97, 216) ${percent}%, #ddd ${percent}%)`;
    };

    const handleTextToSpeech = (inputText: any[]) => {
        const text = inputText.map((word) => word.text).join(" ");
        const speech = new SpeechSynthesisUtterance(text);

        speech.rate = speechSpeed;
        speech.volume = volume / 100;

        speech.onend = () => {
            setIsSpeaking(false);
        }

        window.speechSynthesis.speak(speech);
    };

    // Handle image upload
    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setImageSrc(e.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    // Handle image load and perform OCR with Tesseract.js
    const handleImageLoad = () => {
        if (imageRef.current && canvasRef.current) {
            const imgElement = imageRef.current;
            const canvas = canvasRef.current;

            canvas.ontouchstart = function (e) {
                if (e.touches) e = e.touches[0];
                return false;
            };

            const ctx = canvas.getContext('2d');
            imageScale.current = imgElement.width / imgElement.naturalWidth;
            canvas.width = imgElement.width;
            canvas.height = imgElement.height;
            ctx?.drawImage(imgElement, 0, 0);

            // Perform OCR after image is loaded
            if (window.Tesseract) {
                window.Tesseract.recognize(
                    imgElement,
                    'eng',
                    { logger: (m) => console.log(m) }
                ).then(({ data: { words: detectedWords } }) => {
                    console.log("Words:", detectedWords);
                    setWords(detectedWords);
                    drawBoundingBoxes(detectedWords, ctx);  // Draw bounding boxes immediately after OCR
                });
            }
        }
    };

    // Draw bounding boxes for detected words
    const drawBoundingBoxes = (detectedWords: any[], ctx: CanvasRenderingContext2D) => {
        ctx.clearRect(0, 0, canvasRef.current?.width || 0, canvasRef.current?.height || 0);
        detectedWords.forEach((word) => {
            if (word.bbox) {
                const { x0, y0, x1, y1 } = word.bbox;
                const x = x0 * imageScale.current;
                const y = y0 * imageScale.current;
                const width = (x1 - x0) * imageScale.current;
                const height = (y1 - y0) * imageScale.current;
                ctx.strokeStyle = 'red';
                ctx.lineWidth = 2;
                ctx.strokeRect(x, y, width, height);
            }
        });
    };

    // Handle touch and mouse events for selecting text
    const handleStart = (e: React.TouchEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>) => {
        e.stopPropagation();
        const canvas = canvasRef.current;
        if (canvas) {
            const rect = canvas.getBoundingClientRect();
            const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
            const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
            setSelectionBox({ x: clientX - rect.left, y: clientY - rect.top, width: 0, height: 0 });
            setIsSelecting(true);
        }
    };

    const handleMove = (e: React.TouchEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>) => {
        if (isSelecting && canvasRef.current) {
            const canvas = canvasRef.current;
            const rect = canvas.getBoundingClientRect();
            const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
            const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
            setSelectionBox((prevBox) => ({
                ...prevBox,
                width: clientX - rect.left - prevBox.x,
                height: clientY - rect.top - prevBox.y,
            }));
        }
    };

    const handleEnd = () => {
        setIsSelecting(false);
        const { x, y, width, height } = selectionBox;
        const normalizedX = Math.min(x, x + width);
        const normalizedY = Math.min(y, y + height);
        const normalizedWidth = Math.abs(width);
        const normalizedHeight = Math.abs(height);
        setSelectionBox({ x: normalizedX, y: normalizedY, width: normalizedWidth, height: normalizedHeight });

        if (canvasRef.current) {
            const tolerance = 4;
            const selectedWordsList = words.filter((word) => {
                const { x0, y0, x1, y1 } = word.bbox;
                const wordLeft = x0 * imageScale.current;
                const wordTop = y0 * imageScale.current;
                const wordRight = x1 * imageScale.current;
                const wordBottom = y1 * imageScale.current;

                const isOverlapping = !(wordRight + tolerance < normalizedX ||
                    wordLeft - tolerance > normalizedX + normalizedWidth ||
                    wordBottom + tolerance < normalizedY ||
                    wordTop - tolerance > normalizedY + normalizedHeight);
                return isOverlapping;
            });

            setSelectedWords(selectedWordsList);
            if (isSpeaking) {
                window.speechSynthesis.cancel();
            }
            setIsSpeaking(true);
            handleTextToSpeech(selectedWordsList);
        }
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx && imageRef.current) {
            const imgElement = imageRef.current;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(imgElement, 0, 0);
            drawBoundingBoxes(words, ctx);

            const { x, y, width, height } = selectionBox;
            ctx.strokeStyle = 'blue';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, width, height);
        }
    }, [selectionBox, words]);

    const toggleSpeaking = () => {
        if (!isSpeaking) {
            handleTextToSpeech(selectedWords);
            setIsSpeaking(true);
        } else {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
        }
    };

    const resetState = () => {
        setIsSpeaking(false);
        setSelectedWords([]);
        setWords([]);
        setSelectionBox({x: 0, y: 0, width: 0, height: 0});
        setImageSrc(null);
    }

    const startSpeaking = () => {
        window.speechSynthesis.cancel();
        handleTextToSpeech(selectedWords);
        setIsSpeaking(true);
    };

    function UploadInput() {
        return (
            <div className='upload-container'>
                <label htmlFor="fileUpload" className="custom-upload-button">
                    <FontAwesomeIcon icon={faUpload} style={{ marginRight: '8px' }} />
                    Upload Image
                </label>
                <input
                    id="fileUpload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    style={{ display: 'none' }}
                />
            </div>
        );
    }

    function SelectedWords() {
        if (imageSrc) {
            return (
                <div
                    className="selected-words-box"
                    onClick={() => resetState()}>
                    <h2>Selected Words:</h2>
                    <p>{selectedWords.map((word) => word.text).join(' ')}</p>
                </div>
            );
        }
        return <></>;
    }

    function Controls() {
        if (!imageSrc) {
            return <></>;
        }

        return (
            <div className="controls">
                <button
                    onClick={toggleSpeaking}
                    disabled={selectedWords.length === 0}
                    style={{
                        backgroundColor: selectedWords.length ? (isSpeaking ? '#E43C3C' : '#3FD06F') : '#BBBBBB',
                        color: 'white',
                        padding: '10px 20px',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <FontAwesomeIcon icon={isSpeaking ? faStop : faPlay} style={{ marginRight: '8px' }} />
                    {isSpeaking ? 'Stop Speaking' : 'Start Speaking'}
                </button>
            </div>
        );
    }

    return (
        <div>
            <header>
                <h1>Resonate Text to Speech</h1>
            </header>
            <main>
                <br />
                <h2>Upload an Image to get Started</h2>
                <UploadInput></UploadInput>
                <div id="imageContainer">
                    {imageSrc && (
                        <>
                            <img
                                ref={imageRef}
                                src={imageSrc}
                                alt="Uploaded Image"
                                onLoad={handleImageLoad}
                            />
                            <canvas
                                ref={canvasRef}
                                onTouchStart={handleStart}
                                onTouchMove={handleMove}
                                onTouchEnd={handleEnd}
                                onMouseDown={handleStart}
                                onMouseMove={handleMove}
                                onMouseUp={handleEnd}
                            />
                        </>
                    )}
                </div>
                <SelectedWords />
                <Controls />
                {imageSrc && (
                    <>
                        <div className="slider-container">
                            <label htmlFor="speedSlider">
                                <h3>
                                    Speech Speed (0.25 - 1.75)
                                </h3>
                            </label>
                            <input
                                id="speedSlider"
                                type="range"
                                min="0.25"
                                max="1.75"
                                step="0.05"
                                value={speechSpeed}
                                onChange={(e) => setSpeechSpeed(Number(e.target.value))}
                                onMouseUp={() => startSpeaking()}
                                onTouchEnd={() => startSpeaking()}
                                style={{
                                    background: getSliderBackground(0.25, 1.75, speechSpeed),
                                }}
                            />
                            <span>
                                <h4>{
                                    speechSpeed.toFixed(2)}
                                    <FontAwesomeIcon icon={faTachometerAlt} style={{ marginLeft: '6px' }} />
                                </h4>
                            </span>
                        </div>

                        <div className="slider-container">
                            <label htmlFor="volumeSlider">
                                <h3>
                                    Volume (0 - 100)
                                </h3>
                            </label>
                            <input
                                id="volumeSlider"
                                type="range"
                                min="0"
                                max="100"
                                value={volume}
                                onChange={(e) => setVolume(Number(e.target.value))}
                                onMouseUp={() => startSpeaking()}
                                onTouchEnd={() => startSpeaking()}
                                style={{
                                    background: getSliderBackground(0, 100, volume),
                                }}
                            />
                            <span>
                                <h4>
                                    {volume}
                                    <FontAwesomeIcon icon={faVolumeUp} style={{ marginLeft: '6px' }} />
                                </h4>
                            </span>
                        </div>
                    </>
                )}
            </main>
        </div>
    );
};

export default App;
