import { useEffect, useState } from "react";
import styled from "styled-components";
import Countdown from "react-countdown";
import { Button, CircularProgress, Snackbar } from "@material-ui/core";
import Alert from "@material-ui/lab/Alert";
import './Home.css'
import { useMediaQuery } from 'react-responsive'

import * as anchor from "@project-serum/anchor";

import { LAMPORTS_PER_SOL } from "@solana/web3.js";

import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { WalletDialogButton } from "@solana/wallet-adapter-material-ui";

import {
  CandyMachine,
  awaitTransactionSignatureConfirmation,
  getCandyMachineState,
  mintOneToken,
  shortenAddress,
} from "./candy-machine";

// const ConnectButton = styled(WalletDialogButton)``;

const CounterText = styled.span``; // add your styles here

const MintContainer = styled.div``; // add your styles here

const MintButton = styled(Button)``; // add your styles here

export interface HomeProps {
  candyMachineId: anchor.web3.PublicKey;
  config: anchor.web3.PublicKey;
  connection: anchor.web3.Connection;
  startDate: number;
  treasury: anchor.web3.PublicKey;
  txTimeout: number;
}

const Home = (props: HomeProps) => {
  const [balance, setBalance] = useState<number>();
  const [isActive, setIsActive] = useState(false); // true when countdown completes
  const [isSoldOut, setIsSoldOut] = useState(false); // true when items remaining is zero
  const [isMinting, setIsMinting] = useState(false); // true when user got to press MINT

  const [itemsAvailable, setItemsAvailable] = useState(0);
  const [itemsRedeemed, setItemsRedeemed] = useState(0);
  const [itemsRemaining, setItemsRemaining] = useState(0);

  const [alertState, setAlertState] = useState<AlertState>({
    open: false,
    message: "",
    severity: undefined,
  });

  const [startDate, setStartDate] = useState(new Date(props.startDate));

  const wallet = useAnchorWallet();
  const [candyMachine, setCandyMachine] = useState<CandyMachine>();
  const isMobilePhone = useMediaQuery({query: '(max-width: 850px)'})

  const refreshCandyMachineState = () => {
    (async () => {
      if (!wallet) return;

      const {
        candyMachine,
        goLiveDate,
        itemsAvailable,
        itemsRemaining,
        itemsRedeemed,
      } = await getCandyMachineState(
        wallet as anchor.Wallet,
        props.candyMachineId,
        props.connection
      );

      setItemsAvailable(itemsAvailable);
      setItemsRemaining(itemsRemaining);
      setItemsRedeemed(itemsRedeemed);

      setIsSoldOut(itemsRemaining === 0);
      setStartDate(goLiveDate);
      setCandyMachine(candyMachine);
    })();
  };

  const onMint = async () => {
    try {
      setIsMinting(true);
      if (wallet && candyMachine?.program) {
        const mintTxId = await mintOneToken(
          candyMachine,
          props.config,
          wallet.publicKey,
          props.treasury
        );

        const status = await awaitTransactionSignatureConfirmation(
          mintTxId,
          props.txTimeout,
          props.connection,
          "singleGossip",
          false
        );

        if (!status?.err) {
          setAlertState({
            open: true,
            message: "Congratulations! Mint succeeded!",
            severity: "success",
          });
        } else {
          setAlertState({
            open: true,
            message: "Mint failed! Please try again!",
            severity: "error",
          });
        }
      }
    } catch (error: any) {
      // TODO: blech:
      let message = error.msg || "Minting failed! Please try again!";
      if (!error.msg) {
        if (error.message.indexOf("0x138")) {
        } else if (error.message.indexOf("0x137")) {
          message = `SOLD OUT!`;
        } else if (error.message.indexOf("0x135")) {
          message = `Insufficient funds to mint. Please fund your wallet.`;
        }
      } else {
        if (error.code === 311) {
          message = `SOLD OUT!`;
          setIsSoldOut(true);
        } else if (error.code === 312) {
          message = `Minting period hasn't started yet.`;
        }
      }

      setAlertState({
        open: true,
        message,
        severity: "error",
      });
    } finally {
      if (wallet) {
        const balance = await props.connection.getBalance(wallet.publicKey);
        setBalance(balance / LAMPORTS_PER_SOL);
      }
      setIsMinting(false);
      refreshCandyMachineState();
    }
  };

  useEffect(() => {
    (async () => {
      if (wallet) {
        const balance = await props.connection.getBalance(wallet.publicKey);
        setBalance(balance / LAMPORTS_PER_SOL);
      }
    })();
  }, [wallet, props.connection]);

  useEffect(refreshCandyMachineState, [
    wallet,
    props.candyMachineId,
    props.connection,
  ]);

  return (
    <main>
      {wallet && !isMobilePhone &&
        <div className='homeContainer'>
          <div className='headerContainer'>
            <div className='headerLogo'><img className='imageContainer' src="./favicon.ico" alt="" /></div>
            <div className='headerText'>WILD WEST VERSE</div>
          </div>
          <div className='homeGridContainer'>
            <div className='nftImageContainerOuter'>
              <div className='nftImageContainerInner'><img className='imageContainer' src="./nft.gif" alt="" /></div>
            </div>
            <div className='walletContainer' >
              <div className='walletInnerContainer'>
                <div className='walletTextAreaContainer'>
                  <div className='walletInnerTextContainer'><p className='walletInnerTextLeft'>ADDRESS:</p><p className='walletInnerTextRight'>{shortenAddress(wallet.publicKey.toBase58() || "")}</p></div>
                  <div className='walletInnerTextContainer'><p className='walletInnerTextLeft'>SOL BALANCE:</p><p className='walletInnerTextRight'>{(balance || 0).toLocaleString()} SOL</p></div>
                  <div className='walletInnerTextContainer'><p className='walletInnerTextLeft'>TOTAL:</p><p className='walletInnerTextRight'>{itemsAvailable}</p></div>
                  <div className='walletInnerTextContainer'><p className='walletInnerTextLeft'>AVAILABLE:</p><p className='walletInnerTextRight'>{itemsRemaining}</p></div>
                  <div className='walletInnerTextContainer'><p className='walletInnerTextLeft'>REDEEMED:</p><p className='walletInnerTextRight'>{itemsRedeemed}</p></div>
                  <div className='walletInnerTextContainer'><p className='walletInnerTextLeft'>PRICE:</p><p className='walletInnerTextRight'>0.5 SOL</p></div>
                </div>
                <div className='walletButtonContainer'>
                  <MintContainer>
                    <MintButton
                      disabled={isSoldOut || isMinting || !isActive}
                      onClick={onMint}
                      variant="contained"
                      className='mintButton'
                    >
                      {isSoldOut ? (
                        "SOLD OUT"
                      ) : isActive ? (
                        isMinting ? (
                          <CircularProgress />
                        ) : (
                          <img src='./mintButton.png' alt="Connect Your Wallet" className='mintImage'/>
                        )
                      ) : (
                        <Countdown
                          date={startDate}
                          onMount={({ completed }) => completed && setIsActive(true)}
                          onComplete={() => setIsActive(true)}
                          renderer={renderCounter}
                        />
                      )}
                    </MintButton>
                  </MintContainer>
                </div>
              </div>
            </div>
          </div>
        </div>
      }
      {wallet && isMobilePhone &&
        <div className='mHomeContainer'>
          <div className='mHeaderContainer'>
            <div className='mHeaderLogo'><img className='imageContainer' src="./favicon.ico" alt="" /></div>
            <div className='mHeaderText'>WILD WEST VERSE</div>
          </div>
          <div className='mWalletTextAreaContainer'>
            <div className='walletInnerTextContainer'><p className='walletInnerTextLeft'>ADDRESS:</p><p className='walletInnerTextRight'>{shortenAddress(wallet.publicKey.toBase58() || "")}</p></div>
            <div className='walletInnerTextContainer'><p className='walletInnerTextLeft'>SOL BALANCE:</p><p className='walletInnerTextRight'>{(balance || 0).toLocaleString()} SOL</p></div>
            <div className='walletInnerTextContainer'><p className='walletInnerTextLeft'>TOTAL:</p><p className='walletInnerTextRight'>{itemsAvailable}</p></div>
            <div className='walletInnerTextContainer'><p className='walletInnerTextLeft'>AVAILABLE:</p><p className='walletInnerTextRight'>{itemsRemaining}</p></div>
            <div className='walletInnerTextContainer'><p className='walletInnerTextLeft'>REDEEMED:</p><p className='walletInnerTextRight'>{itemsRedeemed}</p></div>
            <div className='walletInnerTextContainer'><p className='walletInnerTextLeft'>PRICE:</p><p className='walletInnerTextRight'>0.5 SOL</p></div>
          </div>
          <div className='mMintContainer'>
            <MintContainer>
              <MintButton
                disabled={isSoldOut || isMinting || !isActive}
                onClick={onMint}
                variant="contained"
                className='mintButton'
              >
                {isSoldOut ? (
                  "SOLD OUT"
                ) : isActive ? (
                  isMinting ? (
                    <CircularProgress />
                  ) : (
                    <img src='./mintButton.png' alt="Connect Your Wallet" className='mMintImage'/>
                  )
                ) : (
                  <Countdown
                    date={startDate}
                    onMount={({ completed }) => completed && setIsActive(true)}
                    onComplete={() => setIsActive(true)}
                    renderer={renderCounter}
                  />
                )}
              </MintButton>
            </MintContainer>
          </div>
          <div className='mNftImageContainerOuter'>
            <div className='mNftImageContainerInner'><img className='imageContainer' src="./nft.gif" alt="" /></div>
          </div>
        </div>
      }
      <MintContainer>
        {!wallet && !isMobilePhone && (
          <div className='homeContainer'>
            <div className='headerContainer'>
              <div className='headerLogo'><img className='imageContainer' src="./favicon.ico" alt="" /></div>
              <div className='headerText'>WILD WEST VERSE</div>
            </div>
            <div className='homeGridContainer'>
              <div className='nftImageContainerOuter'>
                <div className='nftImageContainerInner'><img className='imageContainer' src="./nft.gif" alt="" /></div>
              </div>
              <div className='walletContainer'>
                <WalletDialogButton className='walletButton'><img src='./connectWallet.png' alt="Connect Your Wallet" className='walletImage'/></WalletDialogButton>
              </div>
            </div>
          </div>
        )}
        {!wallet && isMobilePhone && (
          <div className='mHomeContainer'>
            <div className='mHeaderContainer'>
              <div className='mHeaderLogo'><img className='imageContainer' src="./favicon.ico" alt="" /></div>
              <div className='mHeaderText'>WILD WEST VERSE</div>
            </div>
            <div className='mWalletContainer'>
              <WalletDialogButton className='walletButton'><img src='./connectWallet.png' alt="Connect Your Wallet" className='mWalletImage'/></WalletDialogButton>
            </div>
            <div className='mNftImageContainerOuter'>
              <div className='mNftImageContainerInner'><img className='imageContainer' src="./nft.gif" alt="" /></div>
            </div>
          </div>
        )}
      </MintContainer>

      <Snackbar
        open={alertState.open}
        autoHideDuration={6000}
        onClose={() => setAlertState({ ...alertState, open: false })}
      >
        <Alert
          onClose={() => setAlertState({ ...alertState, open: false })}
          severity={alertState.severity}
        >
          {alertState.message}
        </Alert>
      </Snackbar>
    </main>
  );
};

interface AlertState {
  open: boolean;
  message: string;
  severity: "success" | "info" | "warning" | "error" | undefined;
}

const renderCounter = ({ days, hours, minutes, seconds, completed }: any) => {
  return (
    <CounterText>
      {hours + (days || 0) * 24} hours, {minutes} minutes, {seconds} seconds
    </CounterText>
  );
};

export default Home;
