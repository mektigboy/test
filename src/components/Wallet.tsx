import { ENV } from "../constants";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

const Wallet = () => {
  const { publicKey } = useWallet();

  return (
    <div>
      <div className="mb-25">Network: {ENV}</div>
      {publicKey ? (
        <div className="mb-25">Your address: {publicKey.toBase58()}</div>
      ) : (
        <div className="mb-25">
          <div className="mb-25">Wallet not connected!</div>
          <WalletMultiButton />
        </div>
      )}
    </div>
  );
};

export default Wallet;
