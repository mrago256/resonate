import React, { useState, useRef, useEffect } from 'react';

const App = () => {
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [words, setWords] = useState<any[]>([]);
    const [selectedWords, setSelectedWords] = useState<any[]>([]);
    const [isSelecting, setIsSelecting] = useState<boolean>(false);
    const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; width: number; height: number }>({ x: 0, y: 0, width: 0, height: 0 });

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

    const handleTextToSpeech = (inputText: any[]) => {
        const text = inputText.map((word) => word.text).join(" ");
        const speech = new SpeechSynthesisUtterance(text);
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

    return (
        <div>
            <h1>Text Selection from Image</h1>
            <input type="file" onChange={handleImageUpload} />
            <div id="imageContainer" style={{ position: 'relative', display: 'inline-block' }}>
                {imageSrc && (
                    <>
                        <img
                            ref={imageRef}
                            src={imageSrc}
                            alt="Uploaded Image"
                            onLoad={handleImageLoad}
                            style={{ maxWidth: '100%', display: 'block' }}
                        />
                        <canvas
                            ref={canvasRef}
                            style={{ position: 'absolute', top: 0, left: 0 }}
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

            <div>
                <h2>Selected Words:</h2>
                <p>
                    {selectedWords.map((word) => word.text).join(' ')}
                </p>
            </div>
        </div>
    );
};

export default App;
