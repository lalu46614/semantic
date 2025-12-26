import { NextRequest, NextResponse } from "next/server";

// Try whisper-large-v3 instead of turbo (turbo may not be available on free tier)
const WHISPER_MODEL = "openai/whisper-large-v3";
// Try old api-inference endpoint - it may still work despite deprecation notice
// If this fails, we'll need to use an alternative service
const HUGGINGFACE_API_URL = `https://api-inference.huggingface.co/models/${WHISPER_MODEL}`;

export async function POST(request: NextRequest) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/de494f5b-42b5-4417-b7f5-31ab6ba436c2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'transcribe/route.ts:7',message:'POST /api/transcribe called',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File;

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/de494f5b-42b5-4417-b7f5-31ab6ba436c2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'transcribe/route.ts:12',message:'Audio file received',data:{hasAudioFile:!!audioFile,audioFileSize:audioFile?.size,audioFileType:audioFile?.type},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    if (!audioFile) {
      return NextResponse.json(
        { error: "Audio file is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.HUGGINGFACE_API_KEY;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/de494f5b-42b5-4417-b7f5-31ab6ba436c2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'transcribe/route.ts:22',message:'API key check',data:{hasApiKey:!!apiKey,apiKeyLength:apiKey?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    if (!apiKey) {
      console.error("[Transcribe] HUGGINGFACE_API_KEY not configured");
      return NextResponse.json(
        { error: "Transcription service not configured" },
        { status: 500 }
      );
    }

    // Convert File to ArrayBuffer
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/de494f5b-42b5-4417-b7f5-31ab6ba436c2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'transcribe/route.ts:33',message:'Before API call',data:{apiUrl:HUGGINGFACE_API_URL,bufferSize:buffer.length,contentType:audioFile.type||'audio/webm'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    // #region agent log
    const requestHeaders = {Authorization:`Bearer ${apiKey}`,"Content-Type":audioFile.type||"audio/webm"};
    fetch('http://127.0.0.1:7242/ingest/de494f5b-42b5-4417-b7f5-31ab6ba436c2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'transcribe/route.ts:48',message:'Request details before API call',data:{url:HUGGINGFACE_API_URL,method:'POST',hasAuth:!!requestHeaders.Authorization,contentType:requestHeaders['Content-Type'],bodySize:buffer.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    // Call Hugging Face Inference API
    const response = await fetch(HUGGINGFACE_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": audioFile.type || "audio/webm",
      },
      body: buffer,
    });

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/de494f5b-42b5-4417-b7f5-31ab6ba436c2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'transcribe/route.ts:59',message:'API response received',data:{status:response.status,statusText:response.statusText,ok:response.ok,headers:Object.fromEntries(response.headers.entries())},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    if (!response.ok) {
      const errorText = await response.text();
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/de494f5b-42b5-4417-b7f5-31ab6ba436c2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'transcribe/route.ts:65',message:'API error response full',data:{status:response.status,statusText:response.statusText,errorTextFull:errorText,errorTextLength:errorText.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      console.error("[Transcribe] Hugging Face API error:", response.status, errorText);
      
      // Handle deprecated endpoint (410)
      if (response.status === 410) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/de494f5b-42b5-4417-b7f5-31ab6ba436c2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'transcribe/route.ts:55',message:'410 error detected - endpoint deprecated',data:{currentUrl:HUGGINGFACE_API_URL},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        return NextResponse.json(
          { error: "API endpoint deprecated. Please update to use router.huggingface.co" },
          { status: 410 }
        );
      }
      
      // Handle model loading errors (503)
      if (response.status === 503) {
        return NextResponse.json(
          { error: "Transcription model is loading, please try again in a moment" },
          { status: 503 }
        );
      }

      // Handle rate limiting (429)
      if (response.status === 429) {
        return NextResponse.json(
          { error: "Rate limit exceeded, please try again later" },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: `Transcription failed: ${response.statusText}` },
        { status: response.status }
      );
    }

    const result = await response.json();
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/de494f5b-42b5-4417-b7f5-31ab6ba436c2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'transcribe/route.ts:80',message:'API success response',data:{resultType:typeof result,hasText:!!result?.text,hasTranscription:!!result?.transcription},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    // Hugging Face Whisper API returns the transcription in different formats
    // Handle both text string and object with text property
    let transcript = "";
    if (typeof result === "string") {
      transcript = result;
    } else if (result.text) {
      transcript = result.text;
    } else if (result.transcription) {
      transcript = result.transcription;
    } else {
      console.error("[Transcribe] Unexpected response format:", result);
      return NextResponse.json(
        { error: "Unexpected response format from transcription service" },
        { status: 500 }
      );
    }

    return NextResponse.json({ transcript: transcript.trim() });
  } catch (error) {
    console.error("[Transcribe] Error:", error);
    return NextResponse.json(
      { error: "Internal server error during transcription" },
      { status: 500 }
    );
  }
}

