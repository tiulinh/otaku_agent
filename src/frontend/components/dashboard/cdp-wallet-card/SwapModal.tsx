import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../../ui/button';
import { X, ArrowDownUp, Loader2 } from 'lucide-react';
import { elizaClient } from '../../../lib/elizaClient';
import { getTokenIconBySymbol } from '../../../constants/chains';

interface Token {
  symbol: string;
  name: string;
  balance: string;
  balanceFormatted: string;
  usdValue?: number | null;
  usdPrice?: number | null;
  contractAddress?: string | null;
  chain: string;
  decimals: number;
  icon?: string;
}

interface SwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  tokens: Token[];
  userId: string;
  onSuccess: () => void;
}

export function SwapModal({ isOpen, onClose, tokens, userId, onSuccess }: SwapModalProps) {
  const [fromToken, setFromToken] = useState<Token | null>(null);
  const [toToken, setToToken] = useState<Token | null>(null);
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [slippage, setSlippage] = useState('1'); // 1% default
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [isFromDropdownOpen, setIsFromDropdownOpen] = useState(false);
  const [isToDropdownOpen, setIsToDropdownOpen] = useState(false);
  const fromDropdownRef = useRef<HTMLDivElement>(null);
  const toDropdownRef = useRef<HTMLDivElement>(null);

  // Filter tokens for swap (CDP networks + 1inch supported networks)
  const SWAP_SUPPORTED_NETWORKS = ['base', 'ethereum', 'polygon', 'arbitrum', 'optimism'];
  const swapSupportedTokens = tokens.filter(t => 
    SWAP_SUPPORTED_NETWORKS.includes(t.chain)
  );

  // Helper function to convert amount to base units without scientific notation
  const convertToBaseUnits = (amount: string, decimals: number): string => {
    // Remove any existing decimals and convert to integer string
    const [intPart, decPart = ''] = amount.split('.');
    const paddedDecPart = decPart.padEnd(decimals, '0').slice(0, decimals);
    const result = intPart + paddedDecPart;
    // Remove leading zeros but keep at least one digit
    return result.replace(/^0+/, '') || '0';
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (fromDropdownRef.current && !fromDropdownRef.current.contains(event.target as Node)) {
        setIsFromDropdownOpen(false);
      }
      if (toDropdownRef.current && !toDropdownRef.current.contains(event.target as Node)) {
        setIsToDropdownOpen(false);
      }
    };

    if (isFromDropdownOpen || isToDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFromDropdownOpen, isToDropdownOpen]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setFromToken(null);
      setToToken(null);
      setFromAmount('');
      setToAmount('');
      setSlippage('1');
      setError(null);
      setWarning(null);
      setSuccess(false);
      setTxHash(null);
      setIsFromDropdownOpen(false);
      setIsToDropdownOpen(false);
    }
  }, [isOpen]);

  // Debounced price estimation
  useEffect(() => {
    if (!fromToken || !toToken || !fromAmount || parseFloat(fromAmount) <= 0) {
      setToAmount('');
      return;
    }

    const timeoutId = setTimeout(async () => {
      await estimateSwapPrice();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [fromToken, toToken, fromAmount]);

  const estimateSwapPrice = async () => {
    if (!fromToken || !toToken || !fromAmount || parseFloat(fromAmount) <= 0) {
      return;
    }

    setIsLoadingPrice(true);
    setError(null);
    setWarning(null);

    try {
      // Convert amount to base units (with decimals) - avoid scientific notation
      const amountInBaseUnits = convertToBaseUnits(fromAmount, fromToken.decimals);

      // Send token address or 'eth' for native token - server will normalize it
      const fromTokenAddress = fromToken.contractAddress || 'eth';
      const toTokenAddress = toToken.contractAddress || 'eth';

      const result = await elizaClient.cdp.getSwapPrice({
        name: userId,
        network: fromToken.chain,
        fromToken: fromTokenAddress,
        toToken: toTokenAddress,
        fromAmount: amountInBaseUnits,
      });

      const CDP_NETWORKS = ['base', 'ethereum'];
      const isNonCdpNetwork = !CDP_NETWORKS.includes(fromToken.chain);

      if (result.liquidityAvailable) {
        // Convert toAmount from base units to readable format
        const toAmountFormatted = parseFloat(result.toAmount) / Math.pow(10, toToken.decimals);
        setToAmount(toAmountFormatted.toFixed(6).replace(/\.?0+$/, ''));
      } else if (isNonCdpNetwork) {
        // Non-CDP networks: price estimation not available, but swap is still possible
        setToAmount('Market rate');
        setWarning('Price estimation not available. Swap will execute at market rate via Uniswap V3.');
      } else {
        // CDP network but no liquidity
        setToAmount('');
        setError('Insufficient liquidity for this swap');
      }
    } catch (err) {
      console.error('Error estimating swap price:', err);
      setToAmount('');
      setError('Failed to get swap price. Please try again.');
    } finally {
      setIsLoadingPrice(false);
    }
  };

  const handleSwap = async () => {
    if (!fromToken || !toToken || !fromAmount || parseFloat(fromAmount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    const amount = parseFloat(fromAmount);
    const balance = parseFloat(fromToken.balanceFormatted);

    if (amount > balance) {
      setError(`Insufficient ${fromToken.symbol} balance`);
      return;
    }

    setIsSending(true);
    setError(null);
    setSuccess(false);

    try {
      // Convert amount to base units - avoid scientific notation
      const amountInBaseUnits = convertToBaseUnits(fromAmount, fromToken.decimals);
      
      // Convert slippage to basis points (1% = 100 bps)
      const slippageBps = Math.round(parseFloat(slippage) * 100);

      // Send token address or 'eth' for native token - server will normalize it
      const fromTokenAddress = fromToken.contractAddress || 'eth';
      const toTokenAddress = toToken.contractAddress || 'eth';

      const result = await elizaClient.cdp.swap({
        name: userId,
        network: fromToken.chain,
        fromToken: fromTokenAddress,
        toToken: toTokenAddress,
        fromAmount: amountInBaseUnits,
        slippageBps,
      });

      setTxHash(result.transactionHash);
      setSuccess(true);
      
      // Wait a bit before closing to show success message
      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (err: any) {
      console.error('Error executing swap:', err);
      setError(err?.message || 'Failed to execute swap. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleSwitchTokens = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
    setFromAmount('');
    setToAmount('');
  };

  const handleSetMaxAmount = () => {
    if (fromToken) {
      setFromAmount(fromToken.balanceFormatted);
    }
  };

  // Get token icon (with fallback for native tokens)
  const getTokenIcon = (token: Token) => {
    if (token.icon) {
      return token.icon;
    }
    
    // Try to get from constants by symbol
    const iconPath = getTokenIconBySymbol(token.symbol);
    if (iconPath) {
      return iconPath;
    }
    
    return null;
  };

  if (!isOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div 
        className="bg-background rounded-lg max-w-md w-full max-h-[90vh] p-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-pop rounded-lg p-4 sm:p-6 space-y-4 max-h-[calc(90vh-0.75rem)] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Swap Tokens</h3>
            <Button
              onClick={onClose}
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {success ? (
            // Success State
            <div className="flex-1 overflow-y-auto">
              <div className="space-y-4 py-4">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                    <span className="text-2xl">✓</span>
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-green-500">Swap Successful!</p>
                    {txHash && (
                      <a 
                        href={`https://${fromToken?.chain === 'base' ? 'basescan.org' : 'etherscan.io'}/tx/${txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-muted-foreground hover:text-foreground mt-1 inline-block"
                      >
                        View transaction →
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-4">

              {/* From Token */}
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">From</label>
                <div className="space-y-2" style={{ overflow: 'visible' }}>
                  {/* Custom Dropdown */}
                  <div className="relative" ref={fromDropdownRef} style={{ zIndex: 60 }}>
                    <button
                      type="button"
                      onClick={() => setIsFromDropdownOpen(!isFromDropdownOpen)}
                      className="w-full p-3 border border-border rounded-lg flex items-center justify-between hover:bg-accent/50 transition-colors"
                    >
                      {fromToken ? (
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                            {getTokenIcon(fromToken) ? (
                              <img src={getTokenIcon(fromToken)!} alt={fromToken.symbol} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-sm font-bold text-muted-foreground uppercase">{fromToken.symbol.charAt(0)}</span>
                            )}
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-medium">{fromToken.symbol}</p>
                            <p className="text-xs text-muted-foreground">{fromToken.chain.toUpperCase()}</p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Select a token...</span>
                      )}
                      <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Dropdown Menu */}
                    {isFromDropdownOpen && (
                      <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {swapSupportedTokens
                          .filter(token => {
                            // Hide the exact same token as toToken (same chain and same address/symbol)
                            if (!toToken) return true;
                            return !(token.chain === toToken.chain && (token.contractAddress || token.symbol) === (toToken.contractAddress || toToken.symbol));
                          })
                          .map((token, index) => {
                            return (
                              <button
                                key={`${token.chain}-${token.contractAddress || token.symbol}-${index}`}
                                type="button"
                                onClick={() => {
                                  setFromToken(token);
                                  setFromAmount('');
                                  setToAmount('');
                                  // Reset toToken if it's on a different chain
                                  if (toToken && toToken.chain !== token.chain) {
                                    setToToken(null);
                                  }
                                  setIsFromDropdownOpen(false);
                                }}
                                className={`w-full p-3 flex items-center justify-between hover:bg-accent transition-colors ${
                                  fromToken === token ? 'bg-accent' : ''
                                }`}
                              >
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                                  {getTokenIcon(token) ? (
                                    <img src={getTokenIcon(token)!} alt={token.symbol} className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-sm font-bold text-muted-foreground uppercase">{token.symbol.charAt(0)}</span>
                                  )}
                                </div>
                                <div className="text-left">
                                  <p className="text-sm font-medium">{token.symbol}</p>
                                  <p className="text-xs text-muted-foreground">{token.chain.toUpperCase()}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-mono">{parseFloat(token.balanceFormatted).toFixed(6)}</p>
                                <p className="text-xs text-muted-foreground">${token.usdValue?.toFixed(2) || '0.00'}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Amount Input - Always visible */}
                  <div className="relative">
                    <input
                      type="number"
                      value={fromAmount}
                      onChange={(e) => setFromAmount(e.target.value)}
                      placeholder="0.0"
                      step="any"
                      min="0"
                      disabled={!fromToken}
                      className={`w-full bg-muted border border-border rounded-lg p-3 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                        !fromToken ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    />
                    <Button
                      onClick={handleSetMaxAmount}
                      variant="ghost"
                      size="sm"
                      disabled={!fromToken}
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-7 text-xs"
                    >
                      MAX
                    </Button>
                  </div>
                </div>
              </div>

              {/* Switch Button */}
              <div className="flex justify-center">
                <Button
                  onClick={handleSwitchTokens}
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 rounded-full"
                  disabled={!fromToken && !toToken}
                >
                  <ArrowDownUp className="h-4 w-4" />
                </Button>
              </div>

              {/* To Token */}
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">To</label>
                <div className="space-y-2" style={{ overflow: 'visible' }}>
                  {/* Custom Dropdown */}
                  <div className="relative" ref={toDropdownRef} style={{ zIndex: 50 }}>
                    <button
                      type="button"
                      onClick={() => fromToken && setIsToDropdownOpen(!isToDropdownOpen)}
                      disabled={!fromToken}
                      className={`w-full p-3 border border-border rounded-lg flex items-center justify-between transition-colors ${
                        !fromToken ? 'opacity-50 cursor-not-allowed' : 'hover:bg-accent/50'
                      }`}
                    >
                      {toToken ? (
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                            {getTokenIcon(toToken) ? (
                              <img src={getTokenIcon(toToken)!} alt={toToken.symbol} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-sm font-bold text-muted-foreground uppercase">{toToken.symbol.charAt(0)}</span>
                            )}
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-medium">{toToken.symbol}</p>
                            <p className="text-xs text-muted-foreground">{toToken.chain.toUpperCase()}</p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Select a token...</span>
                      )}
                      <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Dropdown Menu */}
                    {isToDropdownOpen && fromToken && (
                      <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {swapSupportedTokens
                          .filter(t => t.chain === fromToken.chain) // Only show tokens on the same chain as fromToken
                          .filter(t => (t.contractAddress || t.symbol) !== (fromToken.contractAddress || fromToken.symbol)) // Hide the same token as fromToken
                          .map((token, index) => {
                            return (
                              <button
                                key={`${token.chain}-${token.contractAddress || token.symbol}-${index}`}
                                type="button"
                                onClick={() => {
                                  setToToken(token);
                                  setToAmount('');
                                  setIsToDropdownOpen(false);
                                }}
                                className={`w-full p-3 flex items-center justify-between hover:bg-accent transition-colors ${
                                  toToken === token ? 'bg-accent' : ''
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                                    {getTokenIcon(token) ? (
                                      <img src={getTokenIcon(token)!} alt={token.symbol} className="w-full h-full object-cover" />
                                    ) : (
                                      <span className="text-sm font-bold text-muted-foreground uppercase">{token.symbol.charAt(0)}</span>
                                    )}
                                  </div>
                                  <div className="text-left">
                                    <p className="text-sm font-medium">{token.symbol}</p>
                                    <p className="text-xs text-muted-foreground">{token.chain.toUpperCase()}</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-mono">{parseFloat(token.balanceFormatted).toFixed(6)}</p>
                                  <p className="text-xs text-muted-foreground">${token.usdValue?.toFixed(2) || '0.00'}</p>
                                </div>
                              </button>
                            );
                          })}
                      </div>
                    )}
                  </div>

                  {/* Estimated Amount - Always visible */}
                  <div className="relative">
                    <input
                      type="text"
                      value={isLoadingPrice ? 'Calculating...' : toAmount}
                      readOnly
                      placeholder="0.0"
                      disabled={!toToken}
                      className={`w-full bg-muted border border-border rounded-lg p-3 text-sm focus:outline-none cursor-not-allowed ${
                        !toToken ? 'opacity-50' : ''
                      }`}
                    />
                    {isLoadingPrice && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                </div>
              </div>

              {/* Slippage Tolerance */}
              <div className="space-y-2 mt-2">
                <label className="text-xs text-muted-foreground">Slippage Tolerance (%)</label>
                <div className="flex gap-2">
                  {['0.5', '1', '2'].map((value) => (
                    <Button
                      key={value}
                      onClick={() => setSlippage(value)}
                      variant={slippage === value ? 'default' : 'outline'}
                      size="sm"
                      className="flex-1"
                    >
                      {value}%
                    </Button>
                  ))}
                  <input
                    type="number"
                    value={slippage}
                    onChange={(e) => setSlippage(e.target.value)}
                    step="0.1"
                    min="0"
                    max="50"
                    className="w-20 bg-muted border border-border rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Warning Message */}
              {warning && (
                <div className="text-xs text-yellow-500 bg-yellow-500/10 p-2 rounded border border-yellow-500/20">
                  ⚠️ {warning}
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="text-xs text-red-500 bg-red-500/10 p-2 rounded border border-red-500/20">
                  {error}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={onClose}
                  variant="outline"
                  className="flex-1"
                  disabled={isSending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSwap}
                  className="flex-1"
                  disabled={
                    !fromToken || 
                    !toToken || 
                    !fromAmount || 
                    !toAmount || 
                    parseFloat(fromAmount) <= 0 ||
                    isSending ||
                    isLoadingPrice ||
                    !!error
                  }
                >
                  {isSending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Swapping...
                    </>
                  ) : (
                    'Swap'
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

