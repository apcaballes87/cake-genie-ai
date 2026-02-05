import { NextRequest, NextResponse } from 'next/server';

// Server-side configuration for Roboflow (using secure env vars)
const ROBOFLOW_CONFIG = {
    apiKey: process.env.ROBOFLOW_API_KEY || process.env.NEXT_PUBLIC_ROBOFLOW_API_KEY || '',
    workspace: process.env.ROBOFLOW_WORKSPACE || process.env.NEXT_PUBLIC_ROBOFLOW_WORKSPACE || '',
    workflowId: process.env.ROBOFLOW_WORKFLOW_ID || process.env.NEXT_PUBLIC_ROBOFLOW_WORKFLOW_ID || '',
};

export const maxDuration = 30;

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { imageData, mimeType, classes } = body;

        if (!imageData || !mimeType) {
            return NextResponse.json(
                { error: 'Missing required fields: imageData and mimeType' },
                { status: 400 }
            );
        }

        const { apiKey, workspace, workflowId } = ROBOFLOW_CONFIG;

        if (!apiKey || !workspace || !workflowId) {
            console.error('Roboflow configuration missing on server');
            return NextResponse.json(
                { error: 'Object detection service not configured properly' },
                { status: 503 }
            );
        }

        // Construct Roboflow API URL
        const url = `https://serverless.roboflow.com/${workspace}/workflows/${workflowId}`;

        // Construct data URL
        const dataUrl = `data:${mimeType};base64,${imageData}`;

        // Call Roboflow API
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                api_key: apiKey,
                inputs: {
                    image: dataUrl,
                    classes: classes || []
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Roboflow API error:', response.status, errorText);
            return NextResponse.json(
                { error: `Detection provider error: ${response.statusText}` },
                { status: response.status }
            );
        }

        const result = await response.json();

        // Return just the bounding boxes part of the response
        return NextResponse.json({
            bboxes: result.outputs?.bboxes || []
        });

    } catch (error) {
        console.error("Error detecting objects:", error);
        return NextResponse.json(
            { error: 'Failed to detect objects' },
            { status: 500 }
        );
    }
}
