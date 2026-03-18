import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

export function HowToGuide() {
  const [open, setOpen] = useState(false);

  return (
    <Card className="shadow-md border-primary/20">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="cursor-pointer" onClick={() => setOpen(!open)}>
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between w-full">
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                How to Claim $TLC Tokens — Step-by-Step Guide
              </CardTitle>
              <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
            </div>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent>
            <Accordion type="multiple" className="w-full">
              <AccordionItem value="step1">
                <AccordionTrigger>🦊 Step 1: Install and Set Up MetaMask</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 text-sm">
                    <p><strong>Download MetaMask:</strong> Available as a browser extension (Chrome, Firefox, Edge, Brave) or mobile app.</p>
                    <p>👉 <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" className="text-primary underline">metamask.io/download</a></p>
                    <div>
                      <p className="font-semibold mb-1">Create a Wallet:</p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>Click <strong>Create a Wallet</strong> → set a strong password.</li>
                        <li>Save your <strong>Secret Recovery Phrase</strong> securely (never share it).</li>
                      </ul>
                    </div>
                    <p><strong>Access Your Wallet:</strong> Once created, you'll see your Ethereum account address.</p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="step2">
                <AccordionTrigger>🔗 Step 2: Add Polygon Amoy Testnet to MetaMask</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 text-sm">
                    <p>You need to configure MetaMask to connect to the Amoy Testnet. The easiest way is via ChainList.</p>
                    <ol className="list-decimal pl-5 space-y-1">
                      <li>Go to <a href="https://chainlist.org" target="_blank" rel="noopener noreferrer" className="text-primary underline">ChainList.org</a> (trusted aggregator of EVM networks).</li>
                      <li>Search for <strong>Polygon Amoy Testnet</strong>.</li>
                      <li>Click <strong>Add to MetaMask</strong> → approve the connection.</li>
                      <li>MetaMask will now show Polygon Amoy Testnet as a selectable network.</li>
                    </ol>
                    <div className="bg-muted p-3 rounded-lg mt-2">
                      <p className="font-semibold mb-2">Network details (for manual entry):</p>
                      <ul className="space-y-1 font-mono text-xs">
                        <li><strong>Network Name:</strong> Polygon Amoy Testnet</li>
                        <li><strong>RPC URL:</strong> https://rpc-amoy.polygon.technology</li>
                        <li><strong>Chain ID:</strong> 80002</li>
                        <li><strong>Currency Symbol:</strong> POL</li>
                        <li><strong>Block Explorer:</strong> <a href="https://amoy.polygonscan.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">https://amoy.polygonscan.com</a></li>
                      </ul>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="step3">
                <AccordionTrigger>💰 Step 3: Get Free POL Tokens from the Faucet</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 text-sm">
                    <p>POL tokens on Amoy are test tokens used for development.</p>
                    <ol className="list-decimal pl-5 space-y-1">
                      <li>Visit the <a href="https://faucet.polygon.technology/" target="_blank" rel="noopener noreferrer" className="text-primary underline">Polygon Amoy Faucet</a> (commonly linked from Polygon's developer docs).</li>
                      <li>Connect your MetaMask wallet (ensure you're on the Amoy Testnet).</li>
                      <li>Enter your wallet address and request tokens.</li>
                      <li>Within seconds, you'll see POL test tokens in your MetaMask balance.</li>
                    </ol>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="step4">
                <AccordionTrigger>✅ Step 4: Verify Tokens</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 text-sm">
                    <ol className="list-decimal pl-5 space-y-1">
                      <li>Switch MetaMask to <strong>Polygon Amoy Testnet</strong>.</li>
                      <li>Check your balance for POL.</li>
                      <li>You can also confirm transactions on the <a href="https://amoy.polygonscan.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">Amoy Block Explorer</a>.</li>
                    </ol>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="step5">
                <AccordionTrigger>🎯 Step 5: Claim Your $TLC Tokens</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 text-sm">
                    <ol className="list-decimal pl-5 space-y-1">
                      <li>Earn tokens by posting, commenting, receiving likes, joining groups, or claiming your daily login bonus.</li>
                      <li>On this Earn page, click <strong>"Connect Wallet"</strong> to link your MetaMask wallet.</li>
                      <li>Once connected, click <strong>"Claim to Wallet"</strong> to mint your earned $TLC tokens directly to your wallet on Polygon Amoy.</li>
                      <li>Your in-app balance will reset to 0 and the tokens will appear as on-chain $TLC.</li>
                    </ol>
                    <div className="bg-muted p-3 rounded-lg mt-2">
                      <p className="font-semibold mb-1">To see $TLC in MetaMask:</p>
                      <p>Click <strong>"Import Token"</strong> in MetaMask and paste the contract address:</p>
                      <p className="font-mono text-xs mt-1 break-all select-all">0xf95368bF95bAB7E83447E249B6C7e53B3bb858b0</p>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="risks">
                <AccordionTrigger>⚠️ Risks & Tips</AccordionTrigger>
                <AccordionContent>
                  <ul className="list-disc pl-5 space-y-2 text-sm">
                    <li>Testnet tokens have <strong>no real value</strong> — they're only for experimentation.</li>
                    <li>Always double-check you're on the official faucet to avoid phishing sites.</li>
                    <li>Store your <strong>Secret Recovery Phrase</strong> offline; losing it means losing wallet access.</li>
                    <li>If tokens don't appear immediately, wait a few minutes or refresh MetaMask.</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
