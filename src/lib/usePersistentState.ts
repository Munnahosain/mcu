"use client";

import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";
import { idbGet, idbSet } from "@/lib/safeStorage";

type PersistentStateOptions<T> = {
  serialize?: (value: T) => unknown;
  deserialize?: (value: unknown) => T;
};

export function usePersistentState<T>(
  key: string,
  initialValue: T,
  options: PersistentStateOptions<T> = {}
): [T, Dispatch<SetStateAction<T>>, boolean] {
  const [value, setValue] = useState(initialValue);
  const [hydrated, setHydrated] = useState(false);
  const dirty = useRef(false);
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    let active = true;
    void idbGet<unknown>(key).then((saved) => {
      if (!active) return;
      if (!dirty.current && saved !== null) {
        const deserialize = optionsRef.current.deserialize;
        setValue(deserialize ? deserialize(saved) : saved as T);
      }
      setHydrated(true);
    });
    return () => {
      active = false;
    };
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;
    const serialize = optionsRef.current.serialize;
    void idbSet(key, serialize ? serialize(value) : value);
  }, [key, value, hydrated]);

  const setPersistentValue: Dispatch<SetStateAction<T>> = (nextValue) => {
    dirty.current = true;
    setValue(nextValue);
  };

  return [value, setPersistentValue, hydrated];
}