import { NextRequest, NextResponse } from 'next/server';
import { Contract, Wallet, JsonRpcProvider } from 'ethers';
import { MinimalForwarderABI } from '@/lib/contracts/MinimalForwarderABI';

const FORWARDER_ADDRESS = process.env.NEXT_PUBLIC_FORWARDER_ADDRESS!;
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY!;
const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { request: forwardRequest, signature } = body;

    if (!forwardRequest || !signature) {
      return NextResponse.json(
        { error: 'Missing request or signature' },
        { status: 400 }
      );
    }

    // Setup provider and signer
    const provider = new JsonRpcProvider(RPC_URL);
    const relayer = new Wallet(RELAYER_PRIVATE_KEY, provider);
    
    // Create forwarder contract instance
    const forwarder = new Contract(
      FORWARDER_ADDRESS,
      MinimalForwarderABI,
      relayer
    );

    // Verify the request
    const isValid = await forwarder.verify(forwardRequest, signature);
    
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    // Execute the meta-transaction
    const tx = await forwarder.execute(forwardRequest, signature);
    const receipt = await tx.wait();

    return NextResponse.json({
      success: true,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
    });

  } catch (error: unknown) {
    console.error('Relay error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { error: 'Failed to relay transaction', details: errorMessage },
      { status: 500 }
    );
  }
}
