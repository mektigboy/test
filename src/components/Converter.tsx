import {
  FunctionComponent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { INPUT_MINT_ADDRESS, OUTPUT_MINT_ADDRESS } from "../constants";
import { PublicKey, Transaction } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useJupiterApiContext } from "../contexts/JupiterApiProvider";

interface IJupiterFormProps {}
interface IState {
  amount: number;
  inputMint: PublicKey;
  outputMint: PublicKey;
  slippage: number;
}

const JupiterForm: FunctionComponent<IJupiterFormProps> = (props) => {
  const wallet = useWallet();
  const { connection } = useConnection();
  const { tokenMap, routeMap, loaded, api } = useJupiterApiContext();
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formValue, setFormValue] = useState<IState>({
    amount: 1 * 10 ** 6,
    inputMint: new PublicKey(INPUT_MINT_ADDRESS),
    outputMint: new PublicKey(OUTPUT_MINT_ADDRESS),
    slippage: 1, // 0.1%
  });
  const [routes, setRoutes] = useState<
    Awaited<ReturnType<typeof api.v1QuoteGet>>["data"]
  >([]);

  const [inputTokenInfo, outputTokenInfo] = useMemo(() => {
    return [
      tokenMap.get(formValue.inputMint?.toBase58() || ""),
      tokenMap.get(formValue.outputMint?.toBase58() || ""),
    ];
  }, [
    tokenMap,
    formValue.inputMint?.toBase58(),
    formValue.outputMint?.toBase58(),
  ]);

  const fetchRoute = useCallback(() => {
    setIsLoading(true);
    api
      .v1QuoteGet({
        amount: formValue.amount,
        inputMint: formValue.inputMint.toBase58(),
        outputMint: formValue.outputMint.toBase58(),
        slippage: formValue.slippage,
      })
      .then(({ data }) => {
        if (data) {
          setRoutes(data);
        }
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [api, formValue]);

  useEffect(() => {
    fetchRoute();
  }, [fetchRoute]);

  const validOutputMints = useMemo(
    () => routeMap.get(formValue.inputMint?.toBase58() || "") || [],
    [routeMap, formValue.inputMint?.toBase58()]
  );

  useEffect(() => {
    if (formValue.inputMint) {
      const possibleOutputs = routeMap.get(formValue.inputMint.toBase58());

      if (
        possibleOutputs &&
        !possibleOutputs?.includes(formValue.outputMint?.toBase58() || "")
      ) {
        setFormValue((val) => ({
          ...val,
          outputMint: new PublicKey(possibleOutputs[0]),
        }));
      }
    }
  }, [formValue.inputMint?.toBase58(), formValue.outputMint?.toBase58()]);

  if (!loaded) {
    return <div>Loading Jupiter route map...</div>;
  }

  return (
    <div>
      <div>
        <label htmlFor="inputMint">From:</label>
        <select
          id="inputMint"
          name="inputMint"
          value={formValue.inputMint?.toBase58()}
          onChange={(e) => {
            const pbKey = new PublicKey(e.currentTarget.value);
            if (pbKey) {
              setFormValue((val) => ({
                ...val,
                inputMint: pbKey,
              }));
            }
          }}
        >
          {Array.from(routeMap.keys()).map((tokenMint) => {
            return (
              <option key={tokenMint} value={tokenMint}>
                {tokenMap.get(tokenMint)?.name || "Unknown"}
              </option>
            );
          })}
        </select>
      </div>

      <div>
        <label htmlFor="outputMint">Output token</label>
        <select
          id="outputMint"
          name="outputMint"
          value={formValue.outputMint?.toBase58()}
          onChange={(e) => {
            const pbKey = new PublicKey(e.currentTarget.value);
            if (pbKey) {
              setFormValue((val) => ({
                ...val,
                outputMint: pbKey,
              }));
            }
          }}
        >
          {validOutputMints.map((tokenMint) => {
            return (
              <option key={tokenMint} value={tokenMint}>
                {tokenMap.get(tokenMint)?.name || "Unknown"}
              </option>
            );
          })}
        </select>
      </div>

      <div>
        <label htmlFor="amount">Input Amount ({inputTokenInfo?.symbol})</label>
        <div>
          <input
            name="amount"
            id="amount"
            value={formValue.amount}
            type="text"
            pattern="[0-9]*"
            onInput={(e: any) => {
              let newValue = Number(e.target?.value || 0);
              newValue = Number.isNaN(newValue) ? 0 : newValue;
              setFormValue((val) => ({
                ...val,
                amount: Math.max(newValue, 0),
              }));
            }}
          />
        </div>
      </div>
      <div>
        <button
          className={`${
            isLoading ? "opacity-50 cursor-not-allowed" : ""
          } inline-flex items-center px-4 py-2 mt-4 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
          type="button"
          onClick={fetchRoute}
          disabled={isLoading}
        >
          {isLoading && (
            <div
              className={"mr-4 ease-linear rounded-full border-8 border-t-8 border-gray-200 h-24 w-24"}
            ></div>
          )}
          Refresh rate
        </button>
      </div>

      <div>Total routes: {routes?.length}</div>

      {routes?.[0] &&
        (() => {
          const route = routes[0];
          if (route) {
            return (
              <div>
                <div>
                  Best route info :{" "}
                  {route.marketInfos?.map((info) => info.label)}
                </div>
                <div>
                  Output:{" "}
                  {(route.outAmount || 0) /
                    10 ** (outputTokenInfo?.decimals || 1)}{" "}
                  {outputTokenInfo?.symbol}
                </div>
              </div>
            );
          }
        })()}
      <div>
        <button
          type="button"
          disabled={isSubmitting}
          onClick={async () => {
            try {
              if (
                !isLoading &&
                routes?.[0] &&
                wallet.publicKey &&
                wallet.signAllTransactions
              ) {
                setIsSubmitting(true);

                const {
                  swapTransaction,
                  setupTransaction,
                  cleanupTransaction,
                } = await api.v1SwapPost({
                  body: {
                    route: routes[0],
                    userPublicKey: wallet.publicKey.toBase58(),
                  },
                });
                const transactions = (
                  [
                    setupTransaction,
                    swapTransaction,
                    cleanupTransaction,
                  ].filter(Boolean) as string[]
                ).map((tx) => {
                  return Transaction.from(Buffer.from(tx, "base64"));
                });
                await wallet.signAllTransactions(transactions);
                for (let transaction of transactions) {
                  const txId = await connection.sendRawTransaction(
                    transaction.serialize()
                  );
                  await connection.confirmTransaction(txId);
                  console.log(`https://solscan.io/tx/${txId}`);
                }
              }
            } catch (e) {
              console.error(e);
            }
            setIsSubmitting(false);
          }}
        >
          {isSubmitting ? "Swapping.." : "Swap Best Route"}
        </button>
      </div>
    </div>
  );
};

export default JupiterForm;
