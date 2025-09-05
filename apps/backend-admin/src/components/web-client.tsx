import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Switch } from "@heroui/switch";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";

import { useSecuredApi, useAuth } from "@/authentication";
import {
    PTTStartTransmissionRequest,
    PTTAudioChunkRequest,
    PTTEndTransmissionRequest,
    PTTWebSocketMessage,
    NetworkQuality,
    AudioFormat,
    DeviceInfo,
    ClientIdUtils
} from "@/types/ptt";

interface WebClientProps {
    channelUuid: string;
    channelName: string;
    isAdmin: boolean;
}

interface TransmissionState {
    sessionId: string | null;
    isRecording: boolean;
    isTransmitting: boolean;
    startTime: number | null;
    chunksSent: number;
}

function generateUUIDv4(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
/**
 * Utility class for managing ephemeral tokens in web client
 */
class WebClientIdUtils {
    private static readonly TOKEN_KEY = generateUUIDv4(); // Unique key for localStorage

    /**
     * Get or generate an ephemeral token for this client session
     */
    static getEphemeralToken(): string {
        let token = localStorage.getItem(this.TOKEN_KEY);

        if (!token || !ClientIdUtils.isValidEphemeralToken(token)) {
            token = ClientIdUtils.generateEphemeralToken('web');
            localStorage.setItem(this.TOKEN_KEY, token);
        }

        return token;
    }

    /**
     * Clear the stored ephemeral token (useful for logout)
     */
    static clearEphemeralToken(): void {
        localStorage.removeItem(this.TOKEN_KEY);
    }
}

export default function WebClient({ channelUuid, channelName, isAdmin }: WebClientProps) {
    const { t } = useTranslation();
    const { postJson } = useSecuredApi();
    const { getAccessToken } = useAuth();

    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const [transmission, setTransmission] = useState<TransmissionState>({
        sessionId: null,
        isRecording: false,
        isTransmitting: false,
        startTime: null,
        chunksSent: 0
    });

    const websocketRef = useRef<WebSocket | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const sequenceNumberRef = useRef(0);

    const connectToChannel = useCallback(async () => {
        if (isConnected) return;

        setIsConnecting(true);
        setConnectionError(null);

        try {
            // Generate or retrieve ephemeral token for this client
            const ephemeralToken = WebClientIdUtils.getEphemeralToken();

            // Join the channel
            const joinRequest = {
                device_info: {
                    os: "WebClient",
                    os_version: navigator.userAgent,
                    app_version: "1.0.0"
                } as DeviceInfo,
                ephemeral_push_token: ephemeralToken
            };

            const joinResponse = await postJson(
                `${import.meta.env.API_BASE_URL}/v1/channels/${channelUuid}/join`,
                joinRequest
            );

            if (!joinResponse.success) {
                throw new Error(joinResponse.error || t("webclient.join_failed"));
            }

            // Connect to WebSocket for real-time audio
            const accessToken = await getAccessToken();
            const wsUrl = `${import.meta.env.API_BASE_URL.replace('http', 'ws')}/v1/transmissions/ws/${channelUuid}?token=${encodeURIComponent(accessToken || '')}`;
            const ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                console.log("WebSocket connected for channel:", channelUuid);
                setIsConnected(true);
                setIsConnecting(false);
            };

            ws.onmessage = (event) => {
                handleWebSocketMessage(JSON.parse(event.data));
            };

            ws.onerror = (error) => {
                console.error("WebSocket error:", error);
                setConnectionError(t("webclient.websocket_error"));
            };

            ws.onclose = () => {
                console.log("WebSocket disconnected");
                setIsConnected(false);
                setIsConnecting(false);
            };

            websocketRef.current = ws;

        } catch (error) {
            console.error("Failed to connect to channel:", error);
            setConnectionError(error instanceof Error ? error.message : t("webclient.connection_failed"));
            setIsConnecting(false);
        }
    }, [channelUuid, isConnected, postJson, t]);

    const disconnectFromChannel = useCallback(async () => {
        if (!isConnected) return;

        try {
            // Leave the channel with ephemeral token
            const ephemeralToken = WebClientIdUtils.getEphemeralToken();
            await postJson(
                `${import.meta.env.API_BASE_URL}/v1/channels/${channelUuid}/leave`,
                {
                    ephemeral_push_token: ephemeralToken
                }
            );
        } catch (error) {
            console.error("Error leaving channel:", error);
        }

        // Close WebSocket
        if (websocketRef.current) {
            websocketRef.current.close();
            websocketRef.current = null;
        }

        // Stop any ongoing transmission
        if (transmission.isRecording) {
            stopTransmission();
        }

        // Clean up media resources
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }

        setIsConnected(false);
        setTransmission({
            sessionId: null,
            isRecording: false,
            isTransmitting: false,
            startTime: null,
            chunksSent: 0
        });
    }, [channelUuid, isConnected, postJson, transmission.isRecording]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (isConnected) {
                disconnectFromChannel();
            }
        };
    }, [isConnected, disconnectFromChannel]);

    const handleWebSocketMessage = useCallback((message: PTTWebSocketMessage) => {
        console.log("WebClient received WebSocket message:", message);

        switch (message.type) {
            case "transmission_started":
                console.log("Transmission started:", message.session_id);
                break;

            case "audio_chunk":
                console.log("Received audio chunk:", message.data?.sequence);
                if (message.data?.audio_data) {
                    playAudioChunk(message.data.audio_data);
                }
                break;

            case "transmission_ended":
                console.log("Transmission ended:", message.session_id);
                break;

            case "error":
                console.error("WebSocket error:", message.data);
                setConnectionError(message.data?.message || t("webclient.websocket_error"));
                break;
        }
    }, [t]);

    const playAudioChunk = useCallback(async (audioData: string) => {
        try {
            console.log("Decoding audio chunk, data length:", audioData.length);

            // Decode base64 audio data
            const binaryString = atob(audioData);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            console.log("Decoded binary data, length:", bytes.length);

            // Create audio buffer and play
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
                console.log("Created AudioContext");
            }

            console.log("Starting audio decode...");
            const audioBuffer = await audioContextRef.current.decodeAudioData(bytes.buffer.slice());
            console.log("Audio decoded successfully, duration:", audioBuffer.duration);

            const source = audioContextRef.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContextRef.current.destination);
            source.start();
            console.log("Audio playback started");
        } catch (error) {
            console.error("Error playing audio chunk:", error);
        }
    }, []);

    const startTransmission = useCallback(async () => {
        if (!isConnected || transmission.isRecording) return;

        try {
            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 44100,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });

            streamRef.current = stream;

            // Start transmission session
            const startRequest: PTTStartTransmissionRequest = {
                channel_uuid: channelUuid,
                audio_format: "opus" as AudioFormat,
                sample_rate: 44100,
                bitrate: 64000,
                network_quality: "good" as NetworkQuality,
                expected_duration: 30,
                device_info: {
                    os: "WebClient",
                    os_version: navigator.userAgent,
                    app_version: "1.0.0"
                }
            };

            const startResponse = await postJson(
                `${import.meta.env.API_BASE_URL}/v1/transmissions/start`,
                startRequest
            );

            if (!startResponse.success) {
                throw new Error(startResponse.error || t("webclient.transmission_start_failed"));
            }

            const sessionId = startResponse.session_id;

            // Set up MediaRecorder for audio capture
            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });

            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];
            sequenceNumberRef.current = 0;

            mediaRecorder.ondataavailable = async (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                    await sendAudioChunk(sessionId, event.data, sequenceNumberRef.current);
                    sequenceNumberRef.current++;
                }
            };

            mediaRecorder.onstop = async () => {
                await endTransmission(sessionId);
            };

            // Start recording
            mediaRecorder.start(100); // Collect data every 100ms

            setTransmission(prev => ({
                ...prev,
                sessionId,
                isRecording: true,
                isTransmitting: true,
                startTime: Date.now(),
                chunksSent: 0
            }));

        } catch (error) {
            console.error("Error starting transmission:", error);
            setConnectionError(error instanceof Error ? error.message : t("webclient.microphone_access_failed"));
        }
    }, [channelUuid, isConnected, transmission.isRecording, postJson, t]);

    const sendAudioChunk = useCallback(async (sessionId: string, audioBlob: Blob, sequenceNumber: number) => {
        try {
            // Convert blob to base64
            const arrayBuffer = await audioBlob.arrayBuffer();
            const base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

            const chunkRequest: PTTAudioChunkRequest = {
                session_id: sessionId,
                audio_data: base64Data,
                chunk_sequence: sequenceNumber,
                chunk_size_bytes: arrayBuffer.byteLength,
                timestamp_ms: Date.now()
            };

            const response = await postJson(
                `${import.meta.env.API_BASE_URL}/v1/transmissions/${encodeURIComponent(sessionId)}/chunk`,
                chunkRequest
            );

            if (response.success) {
                setTransmission(prev => ({
                    ...prev,
                    chunksSent: prev.chunksSent + 1
                }));
            }
        } catch (error) {
            console.error("Error sending audio chunk:", error);
        }
    }, [postJson]);

    const stopTransmission = useCallback(async () => {
        if (!transmission.isRecording || !transmission.sessionId) return;

        try {
            // Stop recording
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                mediaRecorderRef.current.stop();
            }

            // Clean up media stream
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }

            setTransmission(prev => ({
                ...prev,
                isRecording: false,
                isTransmitting: false
            }));

        } catch (error) {
            console.error("Error stopping transmission:", error);
        }
    }, [transmission.isRecording, transmission.sessionId]);

    const endTransmission = useCallback(async (sessionId: string) => {
        try {
            const duration = transmission.startTime ? Date.now() - transmission.startTime : 0;

            const endRequest: PTTEndTransmissionRequest = {
                session_id: sessionId,
                total_duration_ms: duration,
                total_chunks: sequenceNumberRef.current
            };

            await postJson(
                `${import.meta.env.API_BASE_URL}/v1/transmissions/${encodeURIComponent(sessionId)}/end`,
                endRequest
            );

            setTransmission(prev => ({
                ...prev,
                sessionId: null,
                startTime: null,
                chunksSent: 0
            }));

        } catch (error) {
            console.error("Error ending transmission:", error);
        }
    }, [transmission.startTime, postJson]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (websocketRef.current) {
                websocketRef.current.close();
            }
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
        };
    }, []);

    // Only render if user is admin
    if (!isAdmin) {
        return null;
    }

    return (
        <Card className="max-w-2xl w-full mt-6">
            <CardHeader className="flex gap-3">
                <div className="flex flex-col">
                    <p className="text-md font-semibold">{t("webclient.title")}</p>
                    <p className="text-small text-default-500">{channelName}</p>
                </div>
            </CardHeader>
            <CardBody>
                <div className="space-y-4">
                    {/* Connection Control */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Switch
                                isSelected={isConnected}
                                onValueChange={(enabled) => {
                                    if (enabled) {
                                        connectToChannel();
                                    } else {
                                        disconnectFromChannel();
                                    }
                                }}
                                isDisabled={isConnecting}
                            />
                            <div>
                                <p className="font-semibold">{t("webclient.connection")}</p>
                                <p className="text-small text-default-500">
                                    {isConnecting ? (
                                        <div className="flex items-center gap-2">
                                            <Spinner size="sm" />
                                            {t("webclient.connecting")}
                                        </div>
                                    ) : isConnected ? (
                                        t("webclient.connected")
                                    ) : (
                                        t("webclient.disconnected")
                                    )}
                                </p>
                            </div>
                        </div>

                        {isConnected && (
                            <Chip
                                color="success"
                                variant="flat"
                                startContent={<div className="w-2 h-2 bg-green-500 rounded-full" />}
                            >
                                {t("webclient.live")}
                            </Chip>
                        )}
                    </div>

                    {/* Transmission Control */}
                    {isConnected && (
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Button
                                    color={transmission.isRecording ? "danger" : "primary"}
                                    variant={transmission.isRecording ? "solid" : "flat"}
                                    onPress={() => {
                                        if (transmission.isRecording) {
                                            stopTransmission();
                                        } else {
                                            startTransmission();
                                        }
                                    }}
                                    isDisabled={!isConnected}
                                    startContent={
                                        transmission.isRecording ? (
                                            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                                        ) : null
                                    }
                                >
                                    {transmission.isRecording ? t("webclient.stop_talking") : t("webclient.start_talking")}
                                </Button>

                                <div>
                                    <p className="font-semibold">{t("webclient.transmission")}</p>
                                    <p className="text-small text-default-500">
                                        {transmission.isRecording ? (
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                                {t("webclient.recording")}
                                                {transmission.chunksSent > 0 && (
                                                    <span>({transmission.chunksSent} {t("webclient.chunks")})</span>
                                                )}
                                            </div>
                                        ) : (
                                            t("webclient.ready")
                                        )}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Error Display */}
                    {connectionError && (
                        <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg">
                            <p className="text-danger-700 text-sm">{connectionError}</p>
                        </div>
                    )}

                    {/* Status Information */}
                    {isConnected && (
                        <div className="text-xs text-default-500 space-y-1">
                            <p>• {t("webclient.auto_playback_enabled")}</p>
                            <p>• {t("webclient.opus_format_supported")}</p>
                            <p>• {t("webclient.websocket_connected")}</p>
                        </div>
                    )}
                </div>
            </CardBody>
        </Card>
    );
}
